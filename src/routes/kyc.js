import express from 'express'
import mongoose from 'mongoose'
import KYCUserRequest, { KYCStatus } from '../models/KYCUserRequest.js'
import KYCIdentityStep, { KYCIdentityStepStatus } from '../models/KYCIdentityStep.js'
import authMiddleware from '../middlewares/auth.middleware.js'

const router = express.Router()

const buildFilterFromQuery = (query) => {
    const filter = {}
    if (query.status !== undefined) {
        const s = parseInt(query.status, 10)
        if (!Number.isNaN(s)) filter.status = s
    }
    if (query.user && mongoose.Types.ObjectId.isValid(query.user)) filter.user = query.user
    if (query.submitted_before) {
        const d = new Date(query.submitted_before)
        if (!Number.isNaN(d.getTime())) filter.submitted_at = { ...(filter.submitted_at || {}), $lt: d }
    }
    if (query.submitted_after) {
        const d = new Date(query.submitted_after)
        if (!Number.isNaN(d.getTime())) filter.submitted_at = { ...(filter.submitted_at || {}), $gt: d }
    }
    return filter
}

// POST /api/kyc/kyc-requests/:id/steps/:step_id
router.post('/kyc-request/:id/steps/:step_id', authMiddleware, async (req, res) => {
    try {
        const { id: kycRequestId, step_id: stepId } = req.params
        const { value, type } = req.body

        const kycStep = await KYCIdentityStep.findOne({
            _id: stepId,
            status: { $nin: [KYCIdentityStepStatus.TO_VERIFY, KYCIdentityStepStatus.VALIDATED] },
            kyc_user_request: kycRequestId,
        }).populate({
            path: 'kyc_user_request',
            match: { status: { $ne: KYCStatus.REJECTED } },
            populate: { path: 'kyc_steps' },
        })

        if (!kycStep || !kycStep.kyc_user_request) {
            return res.status(404).json({ errors: ['api.form.errors.cant_update_this_step'] })
        }
        const kycRequest = kycStep.kyc_user_request
        if (!kycRequest.user.equals(req.user._id)) return res.status(403).json({ errors: ['Forbidden'] })

        kycStep.value = value
        kycStep.status = KYCIdentityStepStatus.TO_VERIFY
        kycStep.submitted_at = new Date()
        await kycStep.save()

        await kycStep.populate({
            path: 'kyc_user_request',
            populate: { path: 'kyc_steps' },
        })

        const anyToFill = kycStep.kyc_user_request.kyc_steps.some((s) => s.status === KYCIdentityStepStatus.TO_FILL)
        if (!anyToFill) {
            kycStep.kyc_user_request.status = KYCStatus.TO_VERIFY
            kycStep.kyc_user_request.submitted_at = new Date()
            await kycStep.kyc_user_request.save()
        }

        const updatedStep = await KYCIdentityStep.findById(kycStep._id).populate({
            path: 'kyc_user_request',
            populate: { path: 'kyc_steps' },
        })

        return res.status(200).json({ data: updatedStep })
    } catch (err) {
        console.error('Error submitKycUserStep:', err)
        return res.status(500).json({ errors: ['an error occurred sending kyc step'] })
    }
})

// GET /api/kyc/kyc-requests
router.get('/kyc-requests', authMiddleware, async (req, res) => {
    try {
        const rawQuery = { ...req.query }
        Object.keys(rawQuery).forEach((k) => {
            const v = rawQuery[k]
            if (typeof v === 'string' && v.includes('%')) {
                try {
                    rawQuery[k] = decodeURIComponent(v)
                } catch {}
            }
        })

        const limit = Math.min(100, Math.max(1, parseInt(rawQuery.limit || '40', 10)))
        const cursor = rawQuery.cursor ? new Date(rawQuery.cursor) : null
        const filter = buildFilterFromQuery(rawQuery)
        if (cursor && !Number.isNaN(cursor.getTime())) {
            filter.submitted_at = { ...(filter.submitted_at || {}), $lt: cursor }
        }

        const docs = await KYCUserRequest.find(filter).sort({ submitted_at: -1, createdAt: -1 }).limit(limit).populate('kyc_steps')

        const nextCursor = docs.length && docs[docs.length - 1].submitted_at ? docs[docs.length - 1].submitted_at.toISOString() : null

        return res.status(200).json({ per_page: limit, next_cursor: nextCursor, data: docs })
    } catch (error) {
        console.error('getKycRequests error:', error)
        return res.status(400).json({ errors: ['api.form.errors.error_get_kyc_requests'] })
    }
})

// GET /api/kyc/kyc-requests/:id
router.get('/kyc-requests/:id', authMiddleware, async (req, res) => {
    try {
        const { id } = req.params
        if (!mongoose.Types.ObjectId.isValid(id)) return res.status(404).json({ errors: ['api.form.errors.kyc_request_dont_exist'] })

        const kyc = await KYCUserRequest.findById(id).populate('kyc_steps')
        if (!kyc) return res.status(404).json({ errors: ['api.form.errors.kyc_request_dont_exist'] })

        return res.status(200).json({ data: kyc })
    } catch (error) {
        console.error('getKycRequest error:', error)
        return res.status(500).json({ errors: ['api.form.errors.error_get_kyc_request'] })
    }
})

// PUT /api/kyc/kyc-requests/:id/steps/:step_id
router.put('/kyc-requests/:id/steps/:step_id', authMiddleware, async (req, res) => {
    try {
        const { id: requestId, step_id: stepId } = req.params
        const { status, comment } = req.body

        const kycStep = await KYCIdentityStep.findOne({ _id: stepId, kyc_user_request: requestId })
        if (!kycStep) return res.status(404).json({ errors: ['api.form.errors.step_doesnt_exist'] })

        kycStep.status = status
        if (comment !== undefined) kycStep.comment = comment
        kycStep.reviewed_at = new Date()
        await kycStep.save()

        return res.status(200).json({ data: {} })
    } catch (err) {
        console.error('Unexpected error (reviewUserKycStep):', err)
        return res.status(500).json({ errors: ['An unexpected error occurred'] })
    }
})

// PUT /api/kyc/kyc-requests/:id
router.put('/kyc-requests/:id', async (req, res) => {
    try {
        const { id } = req.params
        const { status, comment } = req.body

        const kycRequest = await KYCUserRequest.findById(id)
        if (!kycRequest) return res.status(404).json({ errors: ['api.form.errors.request_doesnt_exist'] })

        kycRequest.status = status
        if (comment !== undefined) kycRequest.comment = comment
        kycRequest.reviewed_at = new Date()
        await kycRequest.save()

        return res.status(200).json({ data: {} })
    } catch (err) {
        console.error('Unexpected error (reviewUserKyc):', err)
        return res.status(500).json({ errors: ['An unexpected error occurred'] })
    }
})

export default router
