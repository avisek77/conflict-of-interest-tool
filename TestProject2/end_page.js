document.addEventListener('DOMContentLoaded', async () => {
    // --- DOM Elements ---
    const summaryContent = document.getElementById('summary-content');
    const downloadButton = document.getElementById('download-button');
    const pageTitle = document.getElementById('page-title');

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
                // Common exposures:
                // - window.jspdf && window.jspdf.jsPDF (UMD)
                // - window.jsPDF (older direct)
                // - window.jspdf && window.jspdf.default && window.jspdf.default.jsPDF (some module bundlers)
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
                    return reject(new Error('Failed to load jsPDF from CDN'));
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
            if (!response.ok) throw new Error('Could not load survey configuration.');
            surveyConfig = await response.json();

            // load answers (may be empty object)
            surveyAnswers = JSON.parse(localStorage.getItem('surveyAnswers')) || {};

            // Flatten questions for lookup
            allQuestions = surveyConfig.questions.flatMap(page => page.items || []);

            renderSummary();
            setupEventListeners();
        } catch (error) {
            console.error('Summary page initialization failed:', error);
            if (summaryContent) summaryContent.innerHTML = `<p class="error">${error.message}</p>`;
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
                return currentValue === condition.value;
            case 'not_equals':
                return currentValue !== condition.value;
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
            if (id === 'DateOfCompletion') continue;

            const question = allQuestions.find(q => q.id === id);
            if (!question) continue;
            if (!['textarea', 'text', 'date', 'checkbox', 'yesno'].includes(question.type)) continue;
            if (!isQuestionVisible(question)) continue;

            shownAny = true;
            let answer = surveyAnswers[id];

            if (question.type === 'checkbox') {
                answer = answer ? 'Accepted' : 'Not Accepted';
            } else if (question.type === 'yesno') {
                const option = (question.options || []).find(opt => opt.value === answer);
                answer = option ? option.label : 'No Answer';
            } else if (!answer) {
                answer = '<em>No answer provided.</em>';
            }

            const summaryItem = document.createElement('div');
            summaryItem.className = 'summary-item';

            // Escape then convert newlines to <br/> to preserve blank lines and line breaks.
            // We use replace(/\r\n|\r|\n/g, '\n') to normalise line endings, then convert first.
            const escapedAnswer = escapeHtml(String(answer || ''));
            const normalized = escapedAnswer.replace(/\r\n|\r|\n/g, '\n');
            const htmlAnswer = normalized.replace(/\n/g, '<br/>');

            summaryItem.innerHTML = `<p><strong>${escapeHtml(question.text)}</strong></p><p>${htmlAnswer}</p>`;
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
     * Generates a PDF (jsPDF) and returns a Blob.
     * Excludes DateOfCompletion and uses system/browser time.
     */
    async function generatePDFasBlob() {
        await ensureJsPDF(); // ensure library loaded

        // locate jsPDF constructor
        const jspdfGlobal = window.jspdf || window.jsPDF || window.jspdf?.default || null;
        let jsPDFCtor = null;
        if (jspdfGlobal) {
            if (typeof jspdfGlobal === 'function') {
                // window.jsPDF constructor directly
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
            throw new Error('jsPDF constructor not found after loading library.');
        }

        if (!surveyConfig) throw new Error('Survey configuration missing');

        const doc = new jsPDFCtor({ unit: 'pt', format: 'a4' });
        const margin = 40;
        const pageWidth = doc.internal.pageSize.getWidth();
        let cursorY = 60;

        // Title
        doc.setFontSize(18);
        doc.text('CONTEGRITY Survey Responses', margin, cursorY);
        cursorY += 22;

        // System date
        const systemDate = new Date();
        const isoDate = systemDate.toLocaleString(); // display in user's locale
        doc.setFontSize(11);
        doc.text(`Date of completion (system): ${isoDate}`, margin, cursorY);
        cursorY += 18;

        doc.setLineWidth(0.5);
        doc.line(margin, cursorY, pageWidth - margin, cursorY);
        cursorY += 18;

        // Iterate through sections & items
        for (const section of surveyConfig.questions || []) {
            const items = section.items || [];
            let sectionHasVisible = false;
            for (const item of items) {
                if (item.id === 'DateOfCompletion') continue;
                if (!['textarea', 'text', 'date', 'checkbox', 'yesno'].includes(item.type)) continue;
                if (!isQuestionVisible(item)) continue;
                if (surveyAnswers[item.id] === undefined) continue;
                sectionHasVisible = true;
                break;
            }
            if (!sectionHasVisible) continue;

            // section heading
            doc.setFontSize(13);
            doc.setFont(undefined, 'bold');
            const sectionTitle = section.title || section.id;
            const sectLines = doc.splitTextToSize(sectionTitle, pageWidth - margin * 2);
            for (const line of sectLines) {
                if (cursorY > doc.internal.pageSize.getHeight() - 60) {
                    doc.addPage();
                    cursorY = 60;
                }
                doc.text(line, margin, cursorY);
                cursorY += 16;
            }
            doc.setFont(undefined, 'normal');
            cursorY += 4;

            // each question
            for (const item of items) {
                if (item.id === 'DateOfCompletion') continue;
                if (!['textarea', 'text', 'date', 'checkbox', 'yesno'].includes(item.type)) continue;
                if (!isQuestionVisible(item)) continue;
                if (surveyAnswers[item.id] === undefined) continue;

                // question text
                doc.setFontSize(11);
                doc.setFont(undefined, 'bold');
                const qLines = doc.splitTextToSize(item.text, pageWidth - margin * 2);
                for (const line of qLines) {
                    if (cursorY > doc.internal.pageSize.getHeight() - 60) {
                        doc.addPage();
                        cursorY = 60;
                    }
                    doc.text(line, margin, cursorY);
                    cursorY += 14;
                }

                // answer formatting
                let answer = surveyAnswers[item.id];
                if (item.type === 'checkbox') {
                    answer = (answer ? 'Accepted' : 'Not Accepted');
                } else if (item.type === 'yesno') {
                    const opt = (item.options || []).find(o => o.value === answer);
                    answer = opt ? opt.label : String(answer);
                } else if (!answer) {
                    answer = 'No answer provided.';
                }

                doc.setFontSize(11);
                doc.setFont(undefined, 'normal');
                // Normalize and respect newlines: split answer into paragraphs by newline,
                // then wrap each paragraph with splitTextToSize so long lines are wrapped.
                const rawAnswer = String(answer === undefined || answer === null ? '' : answer);
                const normalizedAnswer = rawAnswer.replace(/\r\n|\r/g, '\n'); // normalize line endings
                const paragraphs = normalizedAnswer.split('\n');

                for (const para of paragraphs) {
                    // treat empty paragraph as an intentional blank line
                    if (para === '') {
                        cursorY += 14; // add a blank line gap
                        if (cursorY > doc.internal.pageSize.getHeight() - 60) {
                            doc.addPage();
                            cursorY = 60;
                        }
                        continue;
                    }

                    const wrapped = doc.splitTextToSize(para, pageWidth - margin * 2);
                    for (const line of wrapped) {
                        if (cursorY > doc.internal.pageSize.getHeight() - 60) {
                            doc.addPage();
                            cursorY = 60;
                        }
                        doc.text(line, margin + 10, cursorY);
                        cursorY += 14;
                    }
                    // small gap after paragraph
                    cursorY += 6;
                }
                cursorY += 8;
            }
            cursorY += 6;
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

                // Per survey logic, if user selects 'No' to keeping data, clear it after download.
                if (surveyAnswers && surveyAnswers['Keep'] === '2') {
                    localStorage.removeItem('surveyAnswers');
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
