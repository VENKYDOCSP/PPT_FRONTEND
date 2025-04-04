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

                // Ensure text replacement properly clears old content
                slideXML = slideXML.replace(/<a:t>.*?<\/a:t>/gs, "");

                // Find text container
                let textContainerMatch = slideXML.match(/<p:txBody>.*?<\/p:txBody>/s);
                if (textContainerMatch) {
                    let textContainer = textContainerMatch[0];

                    let newContentXML = `<p:txBody>
                        <a:p><a:r><a:t>${title}</a:t></a:r></a:p>
                        ${subtitle ? `<a:p><a:r><a:t>${subtitle}</a:t></a:r></a:p>` : ""}
                        ${content.map(point => `<a:p><a:r><a:t>• ${point}</a:t></a:r></a:p>`).join('')}
                    </p:txBody>`;

                    // Replace full text container
                    slideXML = slideXML.replace(textContainer, newContentXML);
                }

                // Update slide XML in the zip
                zip.file(filePath, slideXML);
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
            setMessage("PowerPoint updated successfully!");
        } catch (error) {
            console.error("Error modifying PPT:", error);
            setMessage("Error modifying PowerPoint. Please try again.");
        } finally {
            setIsLoading(false);
        }
    };

    // const replaceTextInPPTX = async (formattedTextGemini) => {
    //     if (!pptFile) {
    //         setMessage("Please upload a PowerPoint template first.");
    //         return;
    //     }
    //     if (!formattedTextGemini || formattedTextGemini.length === 0) {
    //         setMessage("No structured slide data available.");
    //         return;
    //     }

    //     setIsLoading(true);
    //     setMessage("Modifying PowerPoint...");

    //     try {
    //         let zip = await JSZip.loadAsync(pptFile);
    //         let slideFiles = Object.keys(zip.files)
    //             .filter(file => file.startsWith("ppt/slides/slide") && file.endsWith(".xml"))
    //             .sort((a, b) => {
    //                 let numA = parseInt(a.match(/slide(\d+).xml/)[1], 10);
    //                 let numB = parseInt(b.match(/slide(\d+).xml/)[1], 10);
    //                 return numA - numB;
    //             });


    //         let slidesToKeep = Math.min(slideFiles.length, formattedTextGemini.length);
    //         console.log(slidesToKeep)
    //         console.log(slideFiles.length, formattedTextGemini.length, slideFiles.length > slidesToKeep)

    //         for (let i = 0; i < slidesToKeep ; i++) {
    //             let filePath = slideFiles[i];
    //             let slideXML = await zip.file(filePath).async("string");
    //             let { title, subtitle, content } = formattedTextGemini[i];

    //             // **Preserve font and style settings**
    //             let fontMatch = slideXML.match(/<a:rPr[^>]*>/);
    //             let fontStyle = fontMatch ? fontMatch[0] : "<a:rPr>"; // Default if no match

    //             // **Replace Title (First text block)**
    //             let titleMatch = slideXML.match(/<a:p>.*?<a:t>(.*?)<\/a:t>.*?<\/a:p>/s);
    //             if (titleMatch) {
    //                 let titleBlock = titleMatch[0];
    //                 let updatedTitleBlock = titleBlock.replace(/<a:t>.*?<\/a:t>/s, `<a:t>${title}</a:t>`);
    //                 slideXML = slideXML.replace(titleBlock, updatedTitleBlock);
    //             }

    //             // **Replace Subtitle (Second text block, if exists)**
    //             let subtitleMatch = slideXML.match(/<a:p>.*?<a:t>.*?<\/a:t>.*?<\/a:p>/gs);
    //             if (subtitleMatch && subtitleMatch.length > 1) {
    //                 let subtitleBlock = subtitleMatch[1];
    //                 let updatedSubtitleBlock = subtitleBlock.replace(/<a:t>.*?<\/a:t>/s, `<a:t>${subtitle || ""}</a:t>`);
    //                 slideXML = slideXML.replace(subtitleBlock, updatedSubtitleBlock);
    //             }

    //             // **Replace Content (All remaining text blocks)**
    //             let contentMatch = slideXML.match(/<a:p>.*?<a:t>.*?<\/a:t>.*?<\/a:p>/gs);
    //             if (contentMatch && contentMatch.length > 2) {
    //                 // Remove existing content beyond title/subtitle
    //                 for (let j = 2; j < contentMatch.length; j++) {
    //                     slideXML = slideXML.replace(contentMatch[j], "");
    //                 }

    //                 let bulletPointsXML = content.map(point =>
    //                     `<a:p><a:r>${fontStyle}<a:t>• ${point}</a:t></a:r></a:p>`
    //                 ).join('');

    //                 slideXML = slideXML.replace(contentMatch[2], `${contentMatch[2]}${bulletPointsXML}`);
    //             }

    //             zip.file(filePath, slideXML);
    //         }

    //         if (slideFiles.length > slidesToKeep) {
    //             let presentationXML = await zip.file("ppt/presentation.xml").async("string");

    //             for (let i = slidesToKeep; i < slideFiles.length; i++) {
    //                 let filePath = slideFiles[i];
    //                 delete zip.files[filePath];

    //                 let slideIdMatch = presentationXML.match(new RegExp(`<p:sldId[^>]+r:id="rId\\d+"[^>]*>`, "g"));
    //                 if (slideIdMatch && slideIdMatch[i]) {
    //                     presentationXML = presentationXML.replace(slideIdMatch[i], "");
    //                 }
    //             }

    //             zip.file("ppt/presentation.xml", presentationXML);
    //         }

    //         const updatedPptxBlob = await zip.generateAsync({
    //             type: "blob",
    //             mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation"
    //         });

    //         saveAs(updatedPptxBlob, `Updated-${templateName}`);
    //         setMessage("PowerPoint updated successfully!");
    //     } catch (error) {
    //         console.error("Error modifying PPT:", error);
    //         setMessage("Error modifying PowerPoint. Please try again.");
    //     } finally {
    //         setIsLoading(false);
    //     }
    // };

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