document.addEventListener('DOMContentLoaded', async () => {
    // --- DOM Elements ---
    const summaryContent = document.getElementById('summary-content');
    const downloadButton = document.getElementById('download-button');

    // --- State ---
    let surveyConfig;
    let surveyAnswers;
    let allQuestions = [];

    /**
     * Main function to initialize the summary page.
     */
    async function initializeSummary() {
        try {
            const response = await fetch('main.JSON');
            if (!response.ok) throw new Error('Could not load survey configuration.');
            surveyConfig = await response.json();
            
            surveyAnswers = JSON.parse(localStorage.getItem('surveyAnswers')) || {};
            
            // Flatten all questions from all pages into a single array for easy lookup
            allQuestions = surveyConfig.questions.flatMap(page => page.items || []);

            renderSummary();
            setupEventListeners();

        } catch (error) {
            console.error('Summary page initialization failed:', error);
            summaryContent.innerHTML = `<p class="error">${error.message}</p>`;
        }
    }

    /**
     * Evaluates a single logic condition based on stored answers.
     * @param {object} condition - The condition object from JSON.
     * @returns {boolean} - The result of the logical evaluation.
     */
    function evaluateCondition(condition) {
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
     * @param {object} item - The question item to check.
     * @returns {boolean} - True if the question should be displayed.
     */
    function isQuestionVisible(item) {
        if (!item.logic) {
            return true; // Always visible if no logic is attached
        }
        
        const condition = item.logic.condition;
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
     */
    function renderSummary() {
        // Clear any previous content
        summaryContent.innerHTML = '';

        for (const id in surveyAnswers) {
            const question = allQuestions.find(q => q.id === id);
            
            // Only display if the question exists, is not a heading/info, and was visible
            if (question && ['textarea', 'text', 'date', 'checkbox', 'yesno'].includes(question.type) && isQuestionVisible(question)) {
                let answer = surveyAnswers[id];
                
                // Format answers for readability
                if (question.type === 'checkbox') {
                    answer = answer ? 'Accepted' : 'Not Accepted';
                } else if (question.type === 'yesno') {
                    const option = question.options.find(opt => opt.value === answer);
                    answer = option ? option.label : 'No Answer';
                } else if (!answer) {
                    answer = '<em>No answer provided.</em>';
                }
                
                const summaryItem = document.createElement('div');
                summaryItem.className = 'summary-item'; // For potential styling
                summaryItem.innerHTML = `<p><strong>${question.text}</strong></p><p>${answer}</p>`;
                summaryContent.appendChild(summaryItem);
            }
        }
    }

    /**
     * Generates a plain text version of the summary for download.
     * @returns {string} - The formatted text summary.
     */
    function generateTextSummary() {
        let text = `CONTEGRITY Survey Responses\n=============================\n\n`;

        for (const id in surveyAnswers) {
            const question = allQuestions.find(q => q.id === id);
             if (question && ['textarea', 'text', 'date', 'checkbox', 'yesno'].includes(question.type) && isQuestionVisible(question)) {
                let answer = surveyAnswers[id];
                
                 if (question.type === 'checkbox') {
                    answer = answer ? 'Accepted' : 'Not Accepted';
                } else if (question.type === 'yesno') {
                    const option = question.options.find(opt => opt.value === answer);
                    answer = option ? option.label : 'No Answer';
                } else if (!answer) {
                    answer = 'No answer provided.';
                }
                
                text += `${question.text}\nAnswer: ${answer}\n\n`;
            }
        }
        return text;
    }

    /**
     * Sets up the event listener for the download button and handles data cleanup.
     */
    function setupEventListeners() {
        downloadButton.addEventListener('click', () => {
            const textSummary = generateTextSummary();
            const blob = new Blob([textSummary], { type: 'text/plain;charset=utf-8' });
            
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = 'CONTEGRITY_Responses.txt';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(a.href);

            // Per survey logic, if user selects 'No' to keeping data, clear it after download.
            // '2' corresponds to the "No" value in the JSON for the "Keep" question.
            if (surveyAnswers['Keep'] === '2') {
                localStorage.removeItem('surveyAnswers');
            }
        });
    }

    // --- Start the Application ---
    initializeSummary();
});
