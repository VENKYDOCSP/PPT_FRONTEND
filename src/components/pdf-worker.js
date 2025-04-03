import { getDocument, GlobalWorkerOptions } from "pdfjs-dist";
import workerSrc from "pdfjs-dist/build/pdf.worker.min.js";

GlobalWorkerOptions.workerSrc = workerSrc;
