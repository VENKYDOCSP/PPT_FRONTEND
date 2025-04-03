"use client";
import { useState } from "react";
import PptxGenJS from "pptxgenjs";
import axios from "axios";
import PizZip from "pizzip";
import JSZip from "jszip";
import { saveAs } from "file-saver";
export default function PDFtoPPT() {
    const [pdfText, setPdfText] = useState("");
    const [pdfFile, setPdfFile] = useState(null);
    const [pptFile, setPptFile] = useState(null);
    const [templateName, setTemplateName] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [message, setMessage] = useState("");
    const [formattedTextGemini, setFormattedTextGemini] = useState([]);

    const handlePDFUpload = async (event) => {
        const file = event.target.files[0];
        if (!file) return;

        if (!file.type.includes("pdf") && !file.name.endsWith(".pdf")) {
            setMessage("Please upload a valid PDF file.");
            return;
        }

        
        const MAX_FILE_SIZE = 5 * 1024 * 1024; 
        if (file.size > MAX_FILE_SIZE) {
            setMessage("File is too large. Max 5MB allowed.");
            return;
        }

        setIsLoading(true);
        setMessage("Extracting PDF content...");
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
            setMessage("PDF content extracted successfully!");
        } catch (error) {
            console.error("Error extracting PDF:", error);
            setMessage(`Error: ${error.response?.data?.message || "Failed to extract text."}`);
        } finally {
            setIsLoading(false);
        }
    };



    const handlePPTUpload = (event) => {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.readAsArrayBuffer(file); 

        reader.onload = (e) => {
            setPptFile(e.target.result); 
            setTemplateName(file.name);
            setMessage(`Template "${file.name}" selected.`);
        };

        console.log(file, "pptFile?.name")

        reader.onerror = () => setMessage("Error loading PowerPoint template.");
    };



    const replaceTextInPPTX = async (formattedTextGemini) => {
        if (!pptFile) {
            setMessage("Please upload a PowerPoint template first.");
            return;
        }
        if (!formattedTextGemini || formattedTextGemini.length === 0) {
            setMessage("No structured slide data available.");
            return;
        }

        setIsLoading(true);
        setMessage("Modifying PowerPoint...");

        try {
            let zip = await JSZip.loadAsync(pptFile);

            let slideFiles = Object.keys(zip.files).filter(file =>
                file.startsWith("ppt/slides/slide") && file.endsWith(".xml")
            );

            let slidesToKeep = Math.min(slideFiles.length, formattedTextGemini.length);

            for (let i = 0; i < slidesToKeep; i++) {
                let filePath = slideFiles[i];
                let slideXML = await zip.file(filePath).async("string");

                let { title, subtitle, content } = formattedTextGemini[i];

                
                const titleMatch = slideXML.match(/<a:p>.*?<a:t>(.*?)<\/a:t>.*?<\/a:p>/s);
                let titleStylePrefix = "";
                if (titleMatch) {
                    
                    titleStylePrefix = titleMatch[0].split('<a:t>')[0];
                    
                    slideXML = slideXML.replace(/<a:p>.*?<a:t>.*?<\/a:t>.*?<\/a:p>/s,
                        `${titleStylePrefix}<a:t>${title}</a:t></a:r></a:p>`);
                }

                
                if (subtitle) {
                    
                    const subtitleMatch = slideXML.match(/<a:p>.*?<a:t>.*?<\/a:t>.*?<\/a:p>/gs);
                    if (subtitleMatch && subtitleMatch.length > 1) {
                        
                        const subtitleStylePrefix = subtitleMatch[1].split('<a:t>')[0];
                        
                        slideXML = slideXML.replace(subtitleMatch[1],
                            `${subtitleStylePrefix}<a:t>${subtitle}</a:t></a:r></a:p>`);
                    } else {
                        
                        const insertAfter = titleMatch ? titleMatch[0] : '';
                        if (insertAfter) {
                            slideXML = slideXML.replace(insertAfter,
                                `${insertAfter}${titleStylePrefix.replace(/<a:b\s*\/>/, '')}<a:t>${subtitle}</a:t></a:r></a:p>`);
                        }
                    }
                }

                
                if (content && content.length > 0) {
                    
                    const contentMatch = slideXML.match(/<a:p>.*?<a:t>.*?<\/a:t>.*?<\/a:p>/gs);

                    if (contentMatch && contentMatch.length > 2) {
                        
                        const contentStylePrefix = contentMatch[2].split('<a:t>')[0];
                        
                        for (let j = 2; j < contentMatch.length; j++) {
                            slideXML = slideXML.replace(contentMatch[j], '');
                        }

                        
                        const insertAfter = contentMatch[1] || contentMatch[0];
                        const bulletPointsXML = content.map(point =>
                            `${contentStylePrefix}<a:t>• ${point}</a:t></a:r></a:p>`
                        ).join('');

                        slideXML = slideXML.replace(insertAfter, `${insertAfter}${bulletPointsXML}`);
                    } else {
                        
                        const textShape = slideXML.match(/<p:txBody>.*?<\/p:txBody>/s);
                        if (textShape) {
                            const endOfTxBody = textShape[0].lastIndexOf('</p:txBody>');
                            const textShapeStart = textShape[0].substring(0, endOfTxBody);
                            const textShapeEnd = textShape[0].substring(endOfTxBody);

                            const contentStyle = titleStylePrefix.replace(/<a:b\s*\/>/, ''); 
                            const bulletPointsXML = content.map(point =>
                                `<a:p>${contentStyle}<a:t>• ${point}</a:t></a:r></a:p>`
                            ).join('');

                            const newTextShape = `${textShapeStart}${bulletPointsXML}${textShapeEnd}`;
                            slideXML = slideXML.replace(textShape[0], newTextShape);
                        }
                    }
                }
            }

            // Remove extra slides if needed
            for (let i = slidesToKeep; i < slideFiles.length; i++) {
                delete zip.files[slideFiles[i]];
            }

            // Generate updated PPTX
            const updatedPptxBlob = await zip.generateAsync({
                type: "blob",
                mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation"
            });

            saveAs(updatedPptxBlob, `Updated-${templateName}`);

            setMessage("PowerPoint updated successfully with properly formatted slides!");
        } catch (error) {
            console.error("Error modifying PPT:", error);
            setMessage("Error modifying PowerPoint. Please try again.");
        } finally {
            setIsLoading(false);
        }
    };


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
                                ✓ {pdfFile.name} selected
                            </p>
                        )}
                    </div>

                    <div className="border p-4 rounded-lg bg-white">
                        <h2 className="text-xl font-semibold mb-4">2. Upload PPT Template (Optional)</h2>
                        <input
                            type="file"
                            accept=".ppt,.pptx"
                            onChange={handlePPTUpload}
                            className="w-full p-2 border rounded"
                        />
                        {pptFile && (
                            <p className="mt-2 text-sm text-green-600">
                                ✓ {pptFile.name} selected
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