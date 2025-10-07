document.addEventListener('DOMContentLoaded', async () => {
    // --- DOM Elements ---
    const summaryContent = document.getElementById('summary-content');
    const downloadButton = document.getElementById('download-button');
    // const pageTitle = document.getElementById('page-title'); // Not used, removed for clarity

    // --- State ---
    let surveyConfig;
    let surveyAnswers;
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
            const response = await fetch('main.JSON');
            if (!response.ok) throw new Error('Could not load survey configuration (main.JSON).');
            surveyConfig = await response.json();

            // load answers (may be empty object)
            surveyAnswers = JSON.parse(localStorage.getItem('surveyAnswers')) || {};

            // Flatten questions for lookup
            // Ensure compatibility even if 'items' is nested deeper or not present
            allQuestions = surveyConfig.questions.flatMap(page => page.items || []).filter(item => item && item.id);

            renderSummary();
            setupEventListeners();
        } catch (error) {
            console.error('Summary page initialization failed:', error);
            if (summaryContent) summaryContent.innerHTML = `<p class="error">**Error loading summary:** ${error.message}</p>`;
        }
    }

    /**
     * Evaluates a single logic condition based on stored answers.
     */
    function evaluateCondition(condition) {
        if (!condition) return false;
        const currentValue = surveyAnswers[condition.questionId];
        switch (condition.operator) {
            case 'equals':
                // Check for exact equality
                return String(currentValue) === String(condition.value);
            case 'not_equals':
                // Check for inequality
                return String(currentValue) !== String(condition.value);
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
            return evaluateCondition(condition);
        }
    }

    /**
     * Renders the final summary of questions and answers.
     * NOTE: excludes the DateOfCompletion question (by id).
     */
    function renderSummary() {
        if (!summaryContent) return;
        summaryContent.innerHTML = '';

        // show a header with system date/time
        const systemDate = new Date();
        const dateStr = systemDate.toLocaleString(); // browser locale
        const header = document.createElement('div');
        header.innerHTML = `<p><strong>Date of completion:</strong> ${dateStr}</p><hr/>`;
        summaryContent.appendChild(header);

        let shownAny = false;

        for (const id in surveyAnswers) {
            // Skip DateOfCompletion question entirely to avoid forged dates
            if (id === 'DateOfCompletion' || id === 'Keep') continue;

            const question = allQuestions.find(q => q.id === id);
            if (!question) continue;
            // Original filter: only included textarea, text, date, checkbox, yesno
            if (!['textarea', 'text', 'date', 'checkbox', 'yesno', 'radiogroup', 'dropdown'].includes(question.type)) continue;
            if (!isQuestionVisible(question)) continue;

            shownAny = true;
            let answer = surveyAnswers[id];

            if (question.type === 'checkbox') {
                answer = answer ? 'Accepted' : 'Not Accepted';
            } else if (['yesno', 'radiogroup', 'dropdown'].includes(question.type)) {
                const option = (question.options || []).find(opt => String(opt.value) === String(answer));
                answer = option ? option.label : 'No Answer';
            } else if (!answer) {
                answer = '<em>No answer provided.</em>';
            }
            
            if (answer.includes('No answer provided.')) continue;
            
            const summaryItem = document.createElement('div');
            summaryItem.className = 'summary-item';

            // Escape then convert newlines to <br/> to preserve blank lines and line breaks.
            const escapedAnswer = escapeHtml(String(answer || ''));
            const normalized = escapedAnswer.replace(/\r\n|\r|\n/g, '\n');
            const htmlAnswer = normalized.replace(/\n/g, '<br/>');

            // --- ORIGINAL HTML STRUCTURE (caused the spacing issue in the screen view) ---
            summaryItem.innerHTML = `
                <p><strong>${escapeHtml(question.text)}</strong></p>
                <p style="font-weight: normal;">${htmlAnswer}</p>
            `;
            // -----------------------------------------------------------------------------
            
            summaryContent.appendChild(summaryItem);
        }

        if (!shownAny) {
            summaryContent.insertAdjacentHTML('beforeend', '<p><em>No visible answers to display.</em></p>');
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
            const option = (question.options || []).find(opt => String(opt.value) === String(answer));
            answer = option ? option.label : 'No Answer';
        } else if (!answer) {
            answer = 'No Answer';
        }
        
        return answer;
    }


    /**
     * Generates a PDF (jsPDF) and returns a Blob.
     */
    async function generatePDFasBlob() {
        await ensureJsPDF(); // ensure library loaded

        // locate jsPDF constructor (robust check)
        const jspdfGlobal = window.jspdf || window.jsPDF || window.jspdf?.default || null;
        let jsPDFCtor = null;
        if (jspdfGlobal) {
            if (typeof jspdfGlobal === 'function') {
                jsPDFCtor = jspdfGlobal;
            } else if (jspdfGlobal.jsPDF) {
                jsPDFCtor = jspdfGlobal.jsPDF;
            } else if (jspdfGlobal.default && jspdfGlobal.default.jsPDF) {
                jsPDFCtor = jspdfGlobal.default.jsPDF;
            } else if (jspdfGlobal.default && typeof jspdfGlobal.default === 'function') {
                jsPDFCtor = jspdfGlobal.default;
            }
        }
        if (!jsPDFCtor) {
            throw new Error('jsPDF constructor not found after loading library. Cannot create PDF.');
        }

        if (!surveyConfig) throw new Error('Survey configuration missing');

        const doc = new jsPDFCtor({ unit: 'pt', format: 'a4' });
        const margin = 40;
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        let cursorY = 60;
        
        // Configuration for question filtering (was expanded in later versions)
        const supportedTypes = ['textarea', 'text', 'date', 'checkbox', 'yesno', 'radiogroup', 'dropdown'];

        // Title
        doc.setFontSize(18);
        doc.text('CONTEGRITY Survey Responses', margin, cursorY);
        cursorY += 22;

        // System date
        const systemDate = new Date();
        const isoDate = systemDate.toLocaleString(); // display in user's locale
        doc.setFontSize(11);
        doc.text(`Date of completion: ${isoDate}`, margin, cursorY);
        cursorY += 18;

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
            const items = section.items || [];
            
            // Filter to check if section should be displayed
            const sectionHasVisible = items.some(item => 
                item.id !== 'DateOfCompletion' &&
                supportedTypes.includes(item.type) &&
                isQuestionVisible(item) && 
                surveyAnswers[item.id] !== undefined
            );
            
            if (!sectionHasVisible) continue;

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

            // Each question
            for (const item of items) {
                if (item.id === 'DateOfCompletion' || item.id === 'Keep') continue;
                if (!supportedTypes.includes(item.type)) continue;
                if (!isQuestionVisible(item)) continue;
                
                const rawAnswer = surveyAnswers[item.id];
                const answer = getFormattedAnswer(item, rawAnswer);
                
                if (!rawAnswer || answer === 'No Answer') continue;

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
     * Sets up the event listener for the download button and handles data cleanup.
     */
    function setupEventListeners() {
        if (!downloadButton) return;

        downloadButton.addEventListener('click', async () => {
            try {
                downloadButton.disabled = true;
                const originalText = downloadButton.textContent;
                downloadButton.textContent = 'Generating…';

                const blob = await generatePDFasBlob();
                downloadBlob(blob, 'CONTEGRITY_Responses.pdf');

                // Per survey logic, if user selects 'No' (value '2') to keeping data, clear it after download.
                if (surveyAnswers && String(surveyAnswers['Keep']) === '2') {
                    localStorage.removeItem('surveyAnswers');
                    console.log("Local storage cleared per user request ('Keep' answer was '2').");
                } else {
                    console.log("Local storage retained.");
                }

                downloadButton.textContent = originalText;
                downloadButton.disabled = false;
            } catch (err) {
                console.error('PDF generation failed:', err);
                alert('Failed to generate PDF: ' + (err && err.message ? err.message : String(err)));
                downloadButton.disabled = false;
                downloadButton.textContent = 'Download Responses';
            }
        });
    }

    // --- Start the Application ---
    initializeSummary();
});