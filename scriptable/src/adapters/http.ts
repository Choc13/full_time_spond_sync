import type { Ports } from "../app";

export const scriptableHttp: Ports["http"] = async (method, url, { headers, body } = {}) => {
  const request = new Request(url);
  request.method = method;
  request.timeoutInterval = 30;
  if (headers) request.headers = headers;
  if (body !== undefined) request.body = body;
  let text = "";
  try {
    text = await request.loadString();
  } catch (error) {
    // A successful response with an empty body can land here. No response means a real network failure.
    if (!request.response || !request.response.statusCode) throw error;
  }
  return { status: request.response.statusCode as number, text: text ?? "" };
};
