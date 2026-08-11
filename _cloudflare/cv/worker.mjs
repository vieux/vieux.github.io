import resumePdf from "./resume.pdf";
import resumeText from "./resume.txt";

import { handleRequest } from "./handler.mjs";

const assets = {
  pdf: {
    body: resumePdf,
    contentType: "application/pdf",
    filename: "victor-vieux-resume.pdf",
  },
  text: {
    body: resumeText,
    contentType: "text/plain; charset=utf-8",
    filename: "victor-vieux-resume.txt",
  },
};

export default {
  fetch(request) {
    return handleRequest(request, assets);
  },
};
