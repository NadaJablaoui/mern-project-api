import mongoose from 'mongoose';
import KYCUserRequest, { KYCStatus } from '../models/KYCUserRequest.js';
import KYCIdentityStep, { KYCStepStatus } from '../models/KYCIdentityStep.js';

// Helpers to convert query params to simple Mongo filters (keeps it safe)
const buildFilterFromQuery = (query) => {
  const filter = {};

  if (query.status !== undefined) {
    const s = parseInt(query.status, 10);
    if (!Number.isNaN(s)) filter.status = s;
  }

  if (query.user) {
    // Accept user id (string) or ObjectId
    if (mongoose.Types.ObjectId.isValid(query.user)) filter.user = query.user;
  }

  if (query.submitted_before) {
    const d = new Date(query.submitted_before);
    if (!Number.isNaN(d.getTime())) filter.submitted_at = { ...(filter.submitted_at || {}), $lt: d };
  }

  if (query.submitted_after) {
    const d = new Date(query.submitted_after);
    if (!Number.isNaN(d.getTime())) filter.submitted_at = { ...(filter.submitted_at || {}), $gt: d };
  }

  return filter;
};

/**
 * PUT /users/me/kyc/:id/steps/:step_id
 * Auth required. User submits a KYC step (value array)
 */
export const submitKycUserStep = async (req, res) => {
  try {
    const { id: kycRequestId, step_id: stepId } = req.params;
    const { value, type } = req.body; // validator ensures shape

    // Find the step ensuring:
    // - step id matches
    // - status not TO_VERIFY or VALIDATED
    // - step belongs to a kyc_user_request not in REJECTED
    // Also ensure that the kyc_user_request belongs to the authenticated user
    const kycStep = await KYCIdentityStep.findOne({
      _id: stepId,
      status: { $nin: [KYCStepStatus.TO_VERIFY, KYCStepStatus.VALIDATED] },
      kyc_user_request: kycRequestId,
    }).populate({
      path: 'kyc_user_request',
      match: { status: { $ne: KYCStatus.REJECTED } },
      populate: { path: 'kyc_steps' },
    });

    if (!kycStep || !kycStep.kyc_user_request) {
      return res.status(404).json({ errors: ['api.form.errors.cant_update_this_step'] });
    }

    // Check ownership: the kyc request's user must be the authenticated user
    const kycRequest = kycStep.kyc_user_request;
    if (!kycRequest.user.equals(req.user._id)) {
      return res.status(403).json({ errors: ['Forbidden'] });
    }

    // Update the step value and set status to TO_VERIFY
    kycStep.value = value;
    kycStep.status = KYCStepStatus.TO_VERIFY;
    kycStep.submitted_at = new Date();
    await kycStep.save();

    // reload/populate again to include kyc_user_request and its steps
    await kycStep.populate({
      path: 'kyc_user_request',
      populate: { path: 'kyc_steps' },
    }).execPopulate?.();

    // If no remaining steps are TO_FILL, then update the main request status
    const anyToFill = kycStep.kyc_user_request.kyc_steps.some((s) => s.status === KYCStepStatus.TO_FILL);
    if (!anyToFill) {
      kycStep.kyc_user_request.status = KYCStatus.TO_VERIFY;
      kycStep.kyc_user_request.submitted_at = new Date();
      await kycStep.kyc_user_request.save();
    }

    // return the updated step (populated)
    const updatedStep = await KYCIdentityStep.findById(kycStep._id).populate({
      path: 'kyc_user_request',
      populate: { path: 'kyc_steps' },
    });

    return res.status(200).json({ data: updatedStep });
  } catch (err) {
    console.error('Error submitKycUserStep:', err);
    return res.status(500).json({ errors: ['an error occured sending kyc step'] });
  }
};

/**
 * GET /kyc-requests
 * Admin (or authorized) endpoint to list requests with simple filters and cursor-based pagination.
 * Query params supported: limit, cursor (ISO date string), status, user, submitted_before, submitted_after
 */
export const getKycRequests = async (req, res) => {
  try {
    const rawQuery = { ...req.query };

    // decode any encoded values (similar to querystring.unescape)
    Object.keys(rawQuery).forEach((k) => {
      const v = rawQuery[k];
      if (typeof v === 'string' && v.includes('%')) {
        try {
          rawQuery[k] = decodeURIComponent(v);
        } catch {}
      }
    });

    const limit = Math.min(100, Math.max(1, parseInt(rawQuery.limit || '40', 10)));
    const cursor = rawQuery.cursor ? new Date(rawQuery.cursor) : null;

    // build a filter object from whitelisted query params
    const filter = buildFilterFromQuery(rawQuery);

    // apply cursor: submitted_at < cursor (since we order desc)
    if (cursor && !Number.isNaN(cursor.getTime())) {
      filter.submitted_at = { ...(filter.submitted_at || {}), $lt: cursor };
    }

    // default sort: submitted_at DESC, createdAt DESC fallback
    const docs = await KYCUserRequest.find(filter)
      .sort({ submitted_at: -1, createdAt: -1 })
      .limit(limit)
      .populate('kyc_steps')
      .exec();

    const nextCursor = docs.length > 0 && docs[docs.length - 1].submitted_at
      ? docs[docs.length - 1].submitted_at.toISOString()
      : null;

    return res.status(200).json({
      per_page: limit,
      next_cursor: nextCursor,
      data: docs,
    });
  } catch (error) {
    console.error('getKycRequests error:', error);
    return res.status(400).json({ errors: ['api.form.errors.error_get_kyc_requests'] });
  }
};

/**
 * GET /kyc-requests/:id
 * Returns a single KYC request populated with steps
 */
export const getKycRequest = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(404).json({ errors: ['api.form.errors.kyc_request_dont_exist'] });
    }

    const kyc = await KYCUserRequest.findById(id).populate('kyc_steps').exec();

    if (!kyc) {
      return res.status(404).json({ errors: ['api.form.errors.kyc_request_dont_exist'] });
    }

    return res.status(200).json({ data: kyc });
  } catch (error) {
    console.error('getKycRequest error:', error);
    return res.status(500).json({ errors: ['api.form.errors.error_get_kyc_request'] });
  }
};

/**
 * PUT /kyc-requests/:id/steps/:step_id
 * Admin review of a specific step: change status/comment/reviewed_at
 */
export const reviewUserKycStep = async (req, res) => {
  try {
    const { id: requestId, step_id: stepId } = req.params;
    const { status, comment } = req.body;

    const kycStep = await KYCIdentityStep.findOne({
      _id: stepId,
      kyc_user_request: requestId,
    });

    if (!kycStep) {
      return res.status(404).json({ errors: ['api.form.errors.step_doesnt_exist'] });
    }

    kycStep.status = status;
    if (comment !== undefined) kycStep.comment = comment;
    kycStep.reviewed_at = new Date();

    await kycStep.save();

    return res.status(200).json({ data: {} });
  } catch (err) {
    console.error('Unexpected error (reviewUserKycStep):', err);
    return res.status(500).json({ errors: ['An unexpected error occurred'] });
  }
};

/**
 * PUT /kyc-requests/:id
 * Admin review of entire request: update status/comment/reviewed_at
 */
export const reviewUserKyc = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, comment } = req.body;

    const kycRequest = await KYCUserRequest.findById(id);
    if (!kycRequest) {
      return res.status(404).json({ errors: ['api.form.errors.request_doesnt_exist'] });
    }

    kycRequest.status = status;
    if (comment !== undefined) kycRequest.comment = comment;
    kycRequest.reviewed_at = new Date();

    await kycRequest.save();

    return res.status(200).json({ data: {} });
  } catch (err) {
    console.error('Unexpected error (reviewUserKyc):', err);
    return res.status(500).json({ errors: ['An unexpected error occurred'] });
  }
};
