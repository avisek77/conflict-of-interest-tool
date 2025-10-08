document.addEventListener('DOMContentLoaded', async () => {
    // --- DOM Elements ---
    const summaryContent = document.getElementById('summary-content');
    const downloadButton = document.getElementById('download-button');

    // --- State ---
    let surveyConfig;
    let surveyAnswers;
    let allQuestions = [];

    const JSPDF_CDNS = [
        'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
        'https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js'
    ];

    function ensureJsPDF() {
        // ... (this function is correct, no changes needed)
        return new Promise((resolve, reject) => {
            function hasJsPDF() {
                return Boolean(
                    (window.jspdf && (window.jspdf.jsPDF || (window.jspdf.default && window.jspdf.default.jsPDF))) ||
                    window.jsPDF
                );
            }
            if (hasJsPDF()) {
                return resolve();
            }
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
                    setTimeout(() => {
                        if (hasJsPDF()) return resolve();
                        tryNextCdn();
                    }, 50);
                };
                s.onerror = () => {
                    s.remove();
                    tryNextCdn();
                };
                document.head.appendChild(s);
            }
            tryNextCdn();
        });
    }

    async function initializeSummary() {
        try {
            const response = await fetch('main.JSON');
            if (!response.ok) throw new Error('Could not load survey configuration (main.JSON).');
            surveyConfig = await response.json();
            surveyAnswers = JSON.parse(localStorage.getItem('surveyAnswers')) || {};
            allQuestions = surveyConfig.questions.flatMap(page => page.items || []).filter(item => item && item.id);
            renderSummary();
            setupEventListeners();
        } catch (error) {
            console.error('Summary page initialization failed:', error);
            if (summaryContent) summaryContent.innerHTML = `<p class="error">**Error loading summary:** ${error.message}</p>`;
        }
    }

    function evaluateCondition(condition) {
        // ... (this function is correct, no changes needed)
        if (!condition) return false;
        const currentValue = surveyAnswers[condition.questionId];
        switch (condition.operator) {
            case 'equals':
                return String(currentValue) === String(condition.value);
            case 'not_equals':
                return String(currentValue) !== String(condition.value);
            default:
                return false;
        }
    }

    function isQuestionVisible(item) {
        // ... (this function is correct, no changes needed)
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

    function renderSummary() {
        // ... (this function is correct, no changes needed)
        if (!summaryContent) return;
        summaryContent.innerHTML = '';
        const systemDate = new Date();
        const dateStr = systemDate.toLocaleString();
        const header = document.createElement('div');
        header.innerHTML = `<p><strong>Date of completion:</strong> ${dateStr}</p><hr/>`;
        summaryContent.appendChild(header);
        let shownAny = false;
        for (const id in surveyAnswers) {
            if (id === 'DateOfCompletion' || id === 'Keep') continue;
            const question = allQuestions.find(q => q.id === id);
            if (!question) continue;
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
            if (String(answer).includes('No answer provided.')) continue;
            const summaryItem = document.createElement('div');
            summaryItem.className = 'summary-item';
            const escapedAnswer = escapeHtml(String(answer || ''));
            const normalized = escapedAnswer.replace(/\r\n|\r|\n/g, '\n');
            const htmlAnswer = normalized.replace(/\n/g, '<br/>');
            summaryItem.innerHTML = `<p><strong>${escapeHtml(question.text)}</strong></p><p style="font-weight: normal;">${htmlAnswer}</p>`;
            summaryContent.appendChild(summaryItem);
        }
        if (!shownAny) {
            summaryContent.insertAdjacentHTML('beforeend', '<p><em>No visible answers to display.</em></p>');
        }
    }

    function escapeHtml(str) {
        // ... (this function is correct, no changes needed)
        return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }
    
    function getFormattedAnswer(question, rawAnswer) {
        // ... (this function is correct, no changes needed)
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

    async function generatePDFasBlob() {
        // ... (this function is correct, no changes needed)
        await ensureJsPDF();
        const jspdfGlobal = window.jspdf || window.jsPDF || window.jspdf?.default || null;
        let jsPDFCtor = null;
        if (jspdfGlobal) {
            if (typeof jspdfGlobal === 'function') jsPDFCtor = jspdfGlobal;
            else if (jspdfGlobal.jsPDF) jsPDFCtor = jspdfGlobal.jsPDF;
            else if (jspdfGlobal.default && jspdfGlobal.default.jsPDF) jsPDFCtor = jspdfGlobal.default.jsPDF;
            else if (jspdfGlobal.default && typeof jspdfGlobal.default === 'function') jsPDFCtor = jspdfGlobal.default;
        }
        if (!jsPDFCtor) throw new Error('jsPDF constructor not found after loading library. Cannot create PDF.');
        if (!surveyConfig) throw new Error('Survey configuration missing');
        const doc = new jsPDFCtor({ unit: 'pt', format: 'a4' });
        const margin = 40;
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        let cursorY = 60;
        const supportedTypes = ['textarea', 'text', 'date', 'checkbox', 'yesno', 'radiogroup', 'dropdown'];
        doc.setFontSize(18);
        doc.text('CONTEGRITY Survey Responses', margin, cursorY);
        cursorY += 22;
        const systemDate = new Date();
        const isoDate = systemDate.toLocaleString();
        doc.setFontSize(11);
        doc.text(`Date of completion: ${isoDate}`, margin, cursorY);
        cursorY += 18;
        doc.setLineWidth(0.5);
        doc.line(margin, cursorY, pageWidth - margin, cursorY);
        cursorY += 18;
        function checkPage(neededSpace = 14) {
             if (cursorY + neededSpace > pageHeight - 60) {
                doc.addPage();
                cursorY = 60;
            }
        }
        for (const section of surveyConfig.questions || []) {
            const items = section.items || [];
            const sectionHasVisible = items.some(item => item.id !== 'DateOfCompletion' && supportedTypes.includes(item.type) && isQuestionVisible(item) && surveyAnswers[item.id] !== undefined);
            if (!sectionHasVisible) continue;
            doc.setFontSize(13);
            doc.setFont(undefined, 'bold');
            const sectionTitle = section.title || section.id;
            const sectLines = doc.splitTextToSize(sectionTitle, pageWidth - margin * 2);
            for (const line of sectLines) {
                checkPage(16);
                doc.text(line, margin, cursorY);
                cursorY += 16;
            }
            doc.setFont(undefined, 'normal');
            cursorY += 4;
            for (const item of items) {
                if (item.id === 'DateOfCompletion' || item.id === 'Keep') continue;
                if (!supportedTypes.includes(item.type)) continue;
                if (!isQuestionVisible(item)) continue;
                const rawAnswer = surveyAnswers[item.id];
                const answer = getFormattedAnswer(item, rawAnswer);
                if (!rawAnswer || answer === 'No Answer') continue;
                doc.setFontSize(11);
                doc.setFont(undefined, 'bold');
                if (cursorY > 60) cursorY += 4; 
                const qLines = doc.splitTextToSize(item.text, pageWidth - margin * 2);
                for (const line of qLines) {
                    checkPage(14);
                    doc.text(line, margin, cursorY);
                    cursorY += 14;
                }
                doc.setFontSize(11);
                doc.setFont(undefined, 'normal');
                const answerPadding = 10;
                const normalizedAnswer = String(answer).replace(/\r\n|\r/g, '\n'); 
                const paragraphs = normalizedAnswer.split('\n');
                for (const para of paragraphs) {
                    if (para.trim() === '') {
                        cursorY += 10; 
                        checkPage(10);
                        continue;
                    }
                    const wrapped = doc.splitTextToSize(para, pageWidth - margin * 2 - answerPadding);
                    for (const line of wrapped) {
                        checkPage(14);
                        doc.text(line, margin + answerPadding, cursorY);
                        cursorY += 14;
                    }
                    cursorY += 4;
                }
                cursorY += 4;
            }
            cursorY += 8;
        }
        const blob = doc.output('blob');
        return blob;
    }

    function downloadBlob(blob, filename) {
        // ... (this function is correct, no changes needed)
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename || 'CONTEGRITY_Responses.pdf';
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 2000); 
    }
    
    // --- NEW: This is the correctly defined function for the email form ---
    /**
     * Sets up the email subscription form submission logic.
     */
    function setupSubscriptionForm() {
        const form = document.getElementById('email-subscription-form');
        const emailInput = document.getElementById('subscriber-email');
        const submitButton = document.getElementById('subscribe-button');
        const messageEl = document.getElementById('subscription-message');
        
        if (!form) return;

        form.addEventListener('submit', async (event) => {
            event.preventDefault(); // This is the crucial line that stops the page refresh

            const email = emailInput.value.trim();
            if (!email) {
                messageEl.textContent = 'Please enter a valid email address.';
                messageEl.style.color = '#cc0000';
                return;
            }

            // Disable button and show loading state
            submitButton.disabled = true;
            submitButton.textContent = 'Submitting...';
            messageEl.textContent = '';

            try {
                // NOTE: Using the Formspree URL from your provided file.
                // Replace this if you have a different one.
                const response = await fetch('https://formspree.io/f/xgvnlwdo', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ email: email }),
                });

                if (response.ok) {
                    messageEl.textContent = 'Thank you for subscribing!';
                    messageEl.style.color = '#198a02';
                    emailInput.value = ''; // Clear the input on success
                } else {
                    throw new Error('Submission failed. The server responded with an error.');
                }
            } catch (error) {
                console.error('Subscription form error:', error);
                messageEl.textContent = 'Something went wrong. Please try again later.';
                messageEl.style.color = '#cc0000';
            } finally {
                // Re-enable the button
                submitButton.disabled = false;
                submitButton.textContent = 'Subscribe';
            }
        });
    }

/**
 * Sets up event listeners for ALL interactive elements on the page.
 */
function setupEventListeners() {
    if (downloadButton) {
        downloadButton.addEventListener('click', async () => {
            // ... (your existing download button logic is here and does not need to be changed)
        });
    }
    
    // --- NEW: Add this block to handle the Start Over link ---
    const startOverLink = document.getElementById('start-over-link');
    if (startOverLink) {
        startOverLink.addEventListener('click', () => {
            // Clear the stored survey data before the browser navigates to the new page.
            localStorage.removeItem('surveyAnswers');
            localStorage.removeItem('surveyCompleted');
            console.log('Survey data cleared for a fresh start.');
        });
    }
    // --- End of New Block ---

    // This existing function call should remain after the new block
    setupSubscriptionForm();
}

    // --- Start the Application ---
    initializeSummary();
});