"use client";
import { useState } from "react";
import axios from "axios";



export default function PDFtoPPT() {
    const [pdfText, setPdfText] = useState("");
    const [pdfFile, setPdfFile] = useState(null);
    const [pptFile, setPptFile] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [message, setMessage] = useState("");
    const [formattedTextGemini, setFormattedTextGemini] = useState([]);

    const handlePDFUpload = async (event) => {
        const file = event.target.files[0];
        if (!file) return;

        if (!file.type.includes("pdf") && !file.name.endsWith(".pdf")) {
            setMessage("Please upload a valid PDF file");
            return;
        }


        const File_Size = 5 * 1024 * 1024;
        if (file.size > File_Size) {
            setMessage("File is too large  Max 5MB allowed");
            return;
        }

        setIsLoading(true);
        setMessage("Extracting PDF content");
        setPdfText("");
        setPdfFile(file);

        const formData = new FormData();
        formData.append("pdf", file);

        try {
            const response = await axios.post("http://localhost:5000/extract-pdf", formData, {
                headers: {
                    "Content-Type": "multipart/form-data",
                },
            });

            setPdfText(response.data.extractedText);
            console.log(response.data.structuredContent)
            setFormattedTextGemini(response.data.structuredContent)
            setMessage("PDF content extracted successfully");
        } catch (error) {
            console.error("Error extracting PDF===>", error);
            setMessage(`Error: ${error.response?.data?.message || "Failed to extract text"}`);
        } finally {
            setIsLoading(false);
        }
    };

    const handlePPTUpload = async (event) => {
        const file = event.target.files[0];
        if (!file) return;

        if (!file.type.includes("pptx") && !file.name.endsWith(".pptx")) {
            setMessage("Please upload a valid PDF file");
            return;
        }


        const File_Size = 15 * 1024 * 1024;
        if (file.size > File_Size) {
            setMessage("File is too large Max 15MB allowed");
            return;
        }

        setIsLoading(true);
        setMessage("Uploading PPT");
        // setPdfText("");
        setPptFile(file);

        const formData = new FormData();
        formData.append("ppt", file);

        try {
            const response = await axios.post("http://localhost:5000/upload-template-and-generate", formData, {
                headers: {
                    "Content-Type": "multipart/form-data",
                },
            });

            console.log(response, "response")

            // setPdfText(response.data.extractedText);
            // console.log(response.data.structuredContent)
            // setFormattedTextGemini(response.data.structuredContent)
            setMessage("PPT Upload Successfull");
        } catch (error) {
            console.error("Error extracting PDF:", error);
            setMessage(`Error: ${error.response?.data?.message || "Failed to extract text"}`);
        } finally {
            setIsLoading(false);
        }
    };

    console.log(formattedTextGemini, "formattedTextGemini")

    return (
        <div className="p-6 max-w-4xl mx-auto bg-gray-50 rounded-lg shadow-md">
            <h1 className="text-3xl font-bold mb-6 text-center text-gray-800">📄 PDF to PowerPoint Converter</h1>

            <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="border p-4 rounded-lg bg-white">
                        <h2 className="text-xl font-semibold mb-4">1. Upload PDF Content</h2>
                        <input
                            type="file"
                            accept=".pdf"
                            onChange={handlePDFUpload}
                            className="w-full p-2 border rounded"
                        />
                        {pdfFile && (
                            <p className="mt-2 text-sm text-green-600">
                                 {pdfFile.name} selected
                            </p>
                        )}
                    </div>

                    <div className="border p-4 rounded-lg bg-white">
                        <h2 className="text-xl font-semibold mb-4">2. Upload PPT Template</h2>
                        <input
                            type="file"
                            accept=".ppt,.pptx"
                            onChange={handlePPTUpload}
                            className="w-full p-2 border rounded"
                        />
                        {pptFile && (
                            <p className="mt-2 text-sm text-green-600">
                                 {pptFile.name} selected
                            </p>
                        )}
                    </div>
                </div>

                <div className="flex justify-center">
                    <button
                        onClick={() => replaceTextInPPTX(formattedTextGemini)}
                        className="px-6 py-3 bg-blue-600 text-white rounded-md font-semibold hover:bg-blue-700 disabled:opacity-50"
                        disabled={isLoading || !pdfFile}
                    >
                        {isLoading ? "Processing..." : "Generate PowerPoint"}
                    </button>
                </div>

                {message && (
                    <div className="mt-4 p-3 rounded bg-blue-50 text-blue-800 text-center">
                        {message}
                    </div>
                )}

                {pdfText && (
                    <div className="mt-6">
                        <h2 className="text-xl font-semibold mb-2">Extracted Content Preview</h2>
                        <div className="border p-4 rounded-lg bg-white h-64 overflow-auto">
                            <pre className="whitespace-pre-wrap text-sm">{pdfText}</pre>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}