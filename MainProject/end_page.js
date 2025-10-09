document.addEventListener('DOMContentLoaded', async () => {
    // --- DOM Elements ---
    const summaryContent = document.getElementById('summary-content');
    const downloadButton = document.getElementById('download-button');
    // Note: The 'start-over-button' element is retrieved later in setupEventListeners

    // --- State ---
    let surveyConfig = {};
    let surveyAnswers = {};
    let allQuestions = [];

    // Primary CDN and fallback CDN for jspdf UMD build
    const JSPDF_CDNS = [
        'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
        'https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js'
    ];

    /**
     * Ensure jsPDF is available. If not present, try to load it dynamically.
     * Returns a Promise that resolves when jsPDF is usable.
     */
    function ensureJsPDF() {
        return new Promise((resolve, reject) => {
            // quick-check helper
            function hasJsPDF() {
                // Check for common exposures of the jsPDF constructor
                return Boolean(
                    (window.jspdf && (window.jspdf.jsPDF || (window.jspdf.default && window.jspdf.default.jsPDF))) ||
                    window.jsPDF
                );
            }

            if (hasJsPDF()) {
                return resolve();
            }

            // try to load cdn scripts in order
            let i = 0;
            function tryNextCdn() {
                if (i >= JSPDF_CDNS.length) {
                    // Display error in the download button area
                    if (summaryContent) {
                        summaryContent.insertAdjacentHTML('beforebegin', '<div class="error-message"><strong>Error:</strong> Failed to load jsPDF library. Download feature disabled.</div>');
                    }
                    if (downloadButton) downloadButton.disabled = true;
                    return reject(new Error('Failed to load jsPDF from CDN. Please check your network connection.'));
                }
                const url = JSPDF_CDNS[i++];
                const s = document.createElement('script');
                s.src = url;
                s.async = true;
                s.onload = () => {
                    // small tick to allow globals to settle
                    setTimeout(() => {
                        if (hasJsPDF()) return resolve();
                        // otherwise try next CDN
                        tryNextCdn();
                    }, 50);
                };
                s.onerror = () => {
                    // remove failed script tag and try next
                    s.remove();
                    tryNextCdn();
                };
                document.head.appendChild(s);
            }

            tryNextCdn();
        });
    }

    /**
     * Main function to initialize the summary page.
     */
    async function initializeSummary() {
        try {
            // 1. Load Configuration
            const response = await fetch('main.JSON');
            if (!response.ok) throw new Error('Could not load survey configuration (main.JSON).');
            surveyConfig = await response.json();

            // 2. Load Answers
            surveyAnswers = JSON.parse(localStorage.getItem('surveyAnswers')) || {};

            // 3. Flatten questions for logic lookup
            allQuestions = surveyConfig.questions.flatMap(page => page.items || []).filter(item => item && item.id);

            // 4. Render and Setup
            renderSummary();
            setupEventListeners();
        } catch (error) {
            console.error('Summary page initialization failed:', error);
            if (summaryContent) summaryContent.innerHTML = `<p class="error-message"><strong>Error loading summary:</strong> ${error.message}</p>`;
        }
    }

    /**
     * Evaluates a single logic condition based on stored answers.
     */
    function evaluateCondition(condition) {
        if (!condition) return false;
        // Use String() conversion to ensure consistent comparison (e.g., '1' == 1)
        const currentValue = String(surveyAnswers[condition.questionId] || '');
        const targetValue = String(condition.value);

        switch (condition.operator) {
            case 'equals':
                return currentValue === targetValue;
            case 'not_equals':
                return currentValue !== targetValue;
            default:
                return false;
        }
    }

    /**
     * Checks if a question should be visible based on the survey's logic and stored answers.
     */
    function isQuestionVisible(item) {
        if (!item || !item.logic) return true;
        const condition = item.logic.condition;
        if (!condition) return true;

        if (condition.type === 'OR') {
            return condition.clauses.some(c => evaluateCondition(c));
        } else if (condition.type === 'AND') {
            return condition.clauses.every(c => evaluateCondition(c));
        } else {
            return evaluateCondition(condition); // Simple condition
        }
    }

    // small helper to escape HTML in strings inserted into the DOM
    function escapeHtml(str) {
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    /**
     * Helper to retrieve and format the answer based on question type.
     */
    function getFormattedAnswer(question, rawAnswer) {
        let answer = rawAnswer;

        if (question.type === 'checkbox') {
            answer = answer ? 'Accepted' : 'Not Accepted';
        } else if (['yesno', 'radiogroup', 'dropdown'].includes(question.type)) {
            // Attempt to find the human-readable label for radio/dropdown/yesno
            const option = (question.options || []).find(opt => String(opt.value) === String(answer));
            answer = option ? option.label : 'No Answer';
        } else if (!answer) {
            answer = 'No Answer';
        }
        // If answer is an array (e.g. from multiselect), join it
        if (Array.isArray(answer)) {
            answer = answer.join(', ');
        }

        return String(answer); // Ensure a string is returned
    }

    /**
     * Renders the final summary of questions and answers to the HTML.
     */
    function renderSummary() {
        if (!summaryContent) return;
        summaryContent.innerHTML = '';

        // Add header with system date/time
        const systemDate = new Date();
        const dateStr = systemDate.toLocaleString();
        const header = document.createElement('div');
        header.innerHTML = `<p style="margin-bottom: 5px;"><strong>Date of completion:</strong> ${dateStr}</p><hr/>`;
        summaryContent.appendChild(header);

        let shownAny = false;

        // Iterate through sections from config to maintain order
        for (const section of surveyConfig.questions || []) {
            const sectionHeader = document.createElement('div');
            sectionHeader.className = 'sub-section-header';
            sectionHeader.innerHTML = `<h3>${escapeHtml(section.title)}</h3>`;
            summaryContent.appendChild(sectionHeader);

            const sectionContent = document.createElement('div');

            let sectionHasVisibleAnswers = false;
            let consumedQuestionIds = new Set(); // Set to track answers already merged

            for (let i = 0; i < (section.items || []).length; i++) {
                const item = section.items[i];

                if (consumedQuestionIds.has(item.id)) continue; // Skip if this item was merged into the previous one

                // Skip system/internal keys
                if (item.id === 'DateOfCompletion' || item.id === 'Keep' || item.type === 'info') continue;

                // Only include answerable types
                if (!['textarea', 'text', 'date', 'checkbox', 'yesno', 'radiogroup', 'dropdown'].includes(item.type)) continue;

                // Check visibility logic
                if (!isQuestionVisible(item)) continue;

                const rawAnswer = surveyAnswers[item.id];
                let answer = getFormattedAnswer(item, rawAnswer); // Use let for modification

                // Skip if no meaningful answer provided for the primary question
                if (!rawAnswer || answer === 'No Answer' || (Array.isArray(rawAnswer) && rawAnswer.length === 0)) continue;

                // --- MERGE LOGIC START (HTML) ---
                if (['yesno', 'radiogroup', 'dropdown'].includes(item.type)) {
                    const nextItem = section.items[i + 1];

                    // Check if the next item is a visible, answered text/textarea intended for merging
                    if (nextItem && ['text', 'textarea'].includes(nextItem.type) && isQuestionVisible(nextItem)) {
                        const nextRawAnswer = surveyAnswers[nextItem.id];
                        if (nextRawAnswer && String(nextRawAnswer).trim() !== '') {
                            // Merge the answers: "Yes. Explanation text here"
                            answer += `. ${String(nextRawAnswer).trim()}`;
                            consumedQuestionIds.add(nextItem.id); // Mark the text field as consumed
                        }
                    }
                }
                // --- MERGE LOGIC END (HTML) ---

                sectionHasVisibleAnswers = true;
                shownAny = true;

                const summaryItem = document.createElement('div');
                summaryItem.className = 'summary-item form-group';

                // Escape HTML for display
                const escapedQuestionText = escapeHtml(item.text);
                const escapedAnswer = escapeHtml(answer);

                // Normalize newlines from textareas for HTML display (<br/>)
                const htmlAnswer = escapedAnswer.replace(/\n/g, '<br/>');

                summaryItem.innerHTML = `
                    <p style="margin-bottom: 5px;"><strong>${escapedQuestionText}</strong></p>
                    <p style="white-space: pre-wrap; margin-top: 0; font-weight: normal;">${htmlAnswer}</p>
                `;

                sectionContent.appendChild(summaryItem);
            }

            // Only append section content if it contained visible answers
            if (sectionHasVisibleAnswers) {
                summaryContent.appendChild(sectionContent);
            } else {
                // Remove the section header if no answers were shown in it
                sectionHeader.remove();
            }
        }

        if (!shownAny) {
            summaryContent.insertAdjacentHTML('beforeend', '<p><em>No visible answers to display.</em></p>');
        }
    }


    /**
     * Generates a PDF (jsPDF) and returns a Blob.
     */
    async function generatePDFasBlob() {
        await ensureJsPDF(); // ensure library loaded

        // Locate jsPDF constructor (robust check)
        const jspdfGlobal = window.jspdf || window.jsPDF || window.jspdf?.default || null;
        let jsPDFCtor = null;
        if (jspdfGlobal && typeof jspdfGlobal === 'function') {
            jsPDFCtor = jspdfGlobal;
        } else if (jspdfGlobal && jspdfGlobal.jsPDF) {
            jsPDFCtor = jspdfGlobal.jsPDF;
        } else if (jspdfGlobal?.default && typeof jspdfGlobal.default === 'function') {
             jsPDFCtor = jspdfGlobal.default;
        } else {
             throw new Error('jsPDF constructor not found after loading library. Cannot create PDF.');
        }

        if (Object.keys(surveyConfig).length === 0) throw new Error('Survey configuration missing. Cannot create PDF.');

        const doc = new jsPDFCtor({ unit: 'pt', format: 'a4' });
        const margin = 40;
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        let cursorY = 60;

        // Configuration for question filtering
        const supportedTypes = ['textarea', 'text', 'date', 'checkbox', 'yesno', 'radiogroup', 'dropdown'];

        // Title
        doc.setFontSize(18);
        doc.text('CONTEGRITY Survey Responses', margin, cursorY);
        cursorY += 22;

        // System date
        const systemDate = new Date();
        const isoDate = systemDate.toLocaleString();
        doc.setFontSize(11);
        doc.text(`Date of completion: ${isoDate}`, margin, cursorY);
        cursorY += 18;

        // Separator
        doc.setLineWidth(0.5);
        doc.line(margin, cursorY, pageWidth - margin, cursorY);
        cursorY += 18;

        // Helper function for page breaks
        function checkPage(neededSpace = 14) {
             if (cursorY + neededSpace > pageHeight - 60) {
                 doc.addPage();
                 cursorY = 60;
             }
        }

        // Iterate through sections & items
        for (const section of surveyConfig.questions || []) {
            let sectionHasVisibleAnswers = false;

            // Pre-check section visibility (only necessary to determine if section header should be printed)
            const items = section.items || [];
            if (items.some(item =>
                item.id !== 'DateOfCompletion' &&
                supportedTypes.includes(item.type) &&
                isQuestionVisible(item) &&
                (surveyAnswers[item.id] !== undefined && getFormattedAnswer(item, surveyAnswers[item.id]) !== 'No Answer')
            )) {
                sectionHasVisibleAnswers = true;
            }

            if (!sectionHasVisibleAnswers) continue;

            // Section heading
            doc.setFontSize(13);
            doc.setFont(undefined, 'bold');
            const sectionTitle = section.title || section.id;
            const sectLines = doc.splitTextToSize(sectionTitle, pageWidth - margin * 2);

            // Page check before printing section title
            for (const line of sectLines) {
                checkPage(16);
                doc.text(line, margin, cursorY);
                cursorY += 16;
            }

            doc.setFont(undefined, 'normal');
            cursorY += 4;

            let consumedQuestionIds = new Set(); // Set to track answers already merged

            // Each question
            for (let i = 0; i < items.length; i++) {
                const item = items[i];

                if (consumedQuestionIds.has(item.id)) continue; // Skip if this item was merged into the previous one

                if (item.id === 'DateOfCompletion' || item.id === 'Keep' || item.type === 'info') continue;
                if (!supportedTypes.includes(item.type)) continue;
                if (!isQuestionVisible(item)) continue;

                const rawAnswer = surveyAnswers[item.id];
                let answer = getFormattedAnswer(item, rawAnswer); // Use let for modification

                if (!rawAnswer || answer === 'No Answer' || (Array.isArray(rawAnswer) && rawAnswer.length === 0)) continue;

                // --- MERGE LOGIC START (PDF) ---
                if (['yesno', 'radiogroup', 'dropdown'].includes(item.type)) {
                    const nextItem = items[i + 1];

                    // Check if the next item is a visible, answered text/textarea intended for merging
                    if (nextItem && ['text', 'textarea'].includes(nextItem.type) && isQuestionVisible(nextItem)) {
                        const nextRawAnswer = surveyAnswers[nextItem.id];
                        if (nextRawAnswer && String(nextRawAnswer).trim() !== '') {
                            // Merge the answers: "Yes. Explanation text here"
                            answer += `. ${String(nextRawAnswer).trim()}`;
                            consumedQuestionIds.add(nextItem.id); // Mark the text field as consumed
                        }
                    }
                }
                // --- MERGE LOGIC END (PDF) ---

                // --- 1. Question text ---
                doc.setFontSize(11);
                doc.setFont(undefined, 'bold');

                // Add a small gap before the new question
                if (cursorY > 60) cursorY += 4;

                const qLines = doc.splitTextToSize(item.text, pageWidth - margin * 2);
                for (const line of qLines) {
                    checkPage(14);
                    doc.text(line, margin, cursorY);
                    cursorY += 14;
                }

                // --- 2. Answer formatting and printing ---
                doc.setFontSize(11);
                doc.setFont(undefined, 'normal');

                const answerPadding = 10; // indentation for answer

                // Normalize and respect newlines: split answer into paragraphs by newline,
                const normalizedAnswer = String(answer).replace(/\r\n|\r/g, '\n');
                const paragraphs = normalizedAnswer.split('\n');

                for (const para of paragraphs) {
                    // treat empty paragraph as an intentional blank line
                    if (para.trim() === '') {
                        cursorY += 10;
                        checkPage(10);
                        continue;
                    }

                    // wrap the paragraph text
                    const wrapped = doc.splitTextToSize(para, pageWidth - margin * 2 - answerPadding);
                    for (const line of wrapped) {
                        checkPage(14);
                        doc.text(line, margin + answerPadding, cursorY);
                        cursorY += 14;
                    }
                    // small gap after paragraph (e.g., between textarea paragraphs)
                    cursorY += 4;
                }
                cursorY += 4; // final gap after the full question/answer block
            }
            cursorY += 8; // Extra gap after the section is complete
        }

        // produce blob
        const blob = doc.output('blob');
        return blob;
    }

    /**
     * Triggers a download for a given Blob, with the specified filename.
     */
    function downloadBlob(blob, filename) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename || 'CONTEGRITY_Responses.pdf';
        document.body.appendChild(a);
        a.click();
        a.remove();
        // Clean up the object URL after a short delay
        setTimeout(() => URL.revokeObjectURL(url), 2000);
    }

    /**
     * Sets up the event listeners for the download and start-over buttons.
     */
    function setupEventListeners() {
        // --- DOWNLOAD BUTTON LOGIC ---
        if (downloadButton) {
            downloadButton.addEventListener('click', async () => {
                try {
                    downloadButton.disabled = true;
                    const originalText = downloadButton.textContent;
                    downloadButton.textContent = 'Generating…';

                    // If jsPDF hasn't been guaranteed yet, ensure it loads now
                    await ensureJsPDF();

                    const blob = await generatePDFasBlob();
                    downloadBlob(blob, 'CONTEGRITY_Responses.pdf');

                    // Check the 'Keep' answer (if user chose not to keep data)
                    // '2' is assumed to mean 'No, do not keep the data'
                    if (surveyAnswers && String(surveyAnswers['Keep']) === '2') {
                        // Clear both keys for safety
                        localStorage.removeItem('surveyAnswers');
                        localStorage.removeItem('contegrityResponses');
                        console.log("Local storage cleared per user request ('Keep' answer was '2').");
                    } else {
                        console.log("Local storage retained.");
                    }

                    downloadButton.textContent = originalText;
                    downloadButton.disabled = false;
                } catch (err) {
                    console.error('PDF generation failed:', err);
                    if (summaryContent) {
                         // Insert a visible error message above the summary
                         const errorMessage = document.createElement('div');
                         errorMessage.className = 'error-message';
                         errorMessage.innerHTML = `<strong>Download Failed:</strong> ${err.message}.`;
                         summaryContent.insertAdjacentElement('beforebegin', errorMessage);
                    }
                    downloadButton.disabled = false;
                    downloadButton.textContent = 'Download Responses';
                }
            });
        }

        // --- START OVER BUTTON LOGIC (MODIFIED: Added Confirmation) ---
        const startOverButton = document.getElementById('start-over-button');

        if (startOverButton) {
            startOverButton.addEventListener('click', () => {
                
                // Show confirmation dialog 
                const confirmed = window.confirm(
                    "Are you sure you want to start over? This will permanently erase all your saved answers and return you to the first page of the survey."
                );

                if (confirmed) {
                    // User clicked OK

                    // 1. Clear the keys used to store answers/progress
                    localStorage.removeItem('surveyAnswers');
                    localStorage.removeItem('contegrityResponses'); 
                    
                    console.log("All survey data cleared from local storage. Redirecting to start page.");

                    // 2. Redirect to the first page of the survey
                    window.location.href = 'survey.html'; 
                } else {
                    // User clicked Cancel
                    console.log("Start over cancelled by user.");
                }
            });
        }
    }

    // --- Start the Application ---
    initializeSummary();
});