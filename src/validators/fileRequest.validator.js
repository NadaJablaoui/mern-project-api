import * as yup from "yup";

export const FileRequestForm = yup.object({
  folder: yup.string().required(),
  content_type: yup.string().required(),
  filename: yup.string().required(), // will be ignored (server generates filename)
});
