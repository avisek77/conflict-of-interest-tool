document.addEventListener('DOMContentLoaded', async () => {
    // --- DOM Elements ---
    const introForm = document.getElementById('intro-form');
    const continueButton = document.getElementById('continue-button');

    // --- State ---
    let surveyConfig;
    let requiredFieldIds = [];

    /**
     * Main function to initialize the introduction page.
     */
    async function initializeIntro() {
        try {
            const response = await fetch('survey.JSON');
            if (!response.ok) throw new Error('Could not load survey configuration.');
            surveyConfig = await response.json();

            // Find the introductory page data from the config
            const introPage = surveyConfig.questions.find(q => q.id === surveyConfig.startQuestionId);
            if (introPage && introPage.items) {
                renderIntroQuestions(introPage.items);
                setupEventListeners();
            } else {
                throw new Error('Introduction page configuration not found in survey.JSON.');
            }
        } catch (error) {
            console.error('Introduction page initialization failed:', error);
            introForm.innerHTML = `<p class="error">${error.message}</p>`;
        }
    }

    /**
     * Creates and appends HTML elements for the intro questions.
     * @param {Array} items - The array of question items to render.
     */
    function renderIntroQuestions(items) {
        items.forEach(item => {
            const formGroup = document.createElement('div');
            formGroup.className = 'form-group';

            let inputElement;
            const label = document.createElement('label');
            label.setAttribute('for', item.id);
            // We will set the text content differently for the checkbox below

            switch (item.type) {
                case 'text':
                case 'date':
                    label.textContent = item.text;
                    inputElement = document.createElement('input');
                    inputElement.type = item.type;
                    inputElement.id = item.id;
                    inputElement.name = item.id;
                    formGroup.appendChild(label);
                    formGroup.appendChild(inputElement);
                    break;

                case 'checkbox':
                    formGroup.classList.add('options-container');
                    inputElement = document.createElement('input');
                    inputElement.type = 'checkbox';
                    inputElement.id = item.id;
                    inputElement.name = item.id;
                    
                    const checkboxLabel = document.createElement('label');
                    checkboxLabel.appendChild(inputElement);

                    // Check if this is the disclaimer to add a hyperlink
                    if (item.id === 'Disclaimer') {
                        // Use innerHTML to create the link for Terms and Conditions
                        checkboxLabel.innerHTML += ` I accept the <a href="terms.html" target="_blank">Terms and Conditions</a>`;
                    } else if (item.id === 'PCN') {
                        // Use innerHTML to create the link for Privacy Agreement
                        checkboxLabel.innerHTML += ` I accept the <a href="https://www.contegrityethics.com.au/_files/ugd/e3cd58_d0b0444dc3e0491bba937ef754f06245.pdf" target="_blank">Privacy Agreement</a>`;
                    } else if (item.id === 'EULA') {
                        // Use innerHTML to create the link for End-User License Agreement
                        checkboxLabel.innerHTML += ` I accept the <a href="https://www.contegrityethics.com.au/_files/ugd/e3cd58_eb3989c03f574b0391b410fe69ed57ab.pdf" target="_blank">End-User License Agreement</a>`;
                    } else {
                        // For other checkboxes, just use the text
                        checkboxLabel.appendChild(document.createTextNode(` ${item.text}`));
                    }
                    
                    formGroup.appendChild(checkboxLabel);
                    break;
            }

            if (item.isRequired) {
                requiredFieldIds.push(item.id);
            }

            if (item.help) {
                const helpText = document.createElement('p');
                helpText.className = 'help-text';
                helpText.textContent = item.help;
                formGroup.appendChild(helpText);
            }
            introForm.appendChild(formGroup);
        });
    }

    /**
     * Checks if all required fields on the intro page have been filled.
     * @returns {boolean} - True if validation passes.
     */
    function validateIntroForm() {
        return requiredFieldIds.every(id => {
            const input = document.getElementById(id);
            if (input.type === 'checkbox') {
                return input.checked;
            }
            return input.value.trim() !== '';
        });
    }

    /**
     * Sets up event listeners for form inputs and the continue button.
     */
    function setupEventListeners() {
        // Check validation whenever any input changes
        introForm.addEventListener('input', () => {
            continueButton.disabled = !validateIntroForm();
        });

        // Handle the click of the continue button
        continueButton.addEventListener('click', () => {
            if (!validateIntroForm()) return; // Final check

            const answers = {};
            const introPage = surveyConfig.questions.find(q => q.id === surveyConfig.startQuestionId);

            introPage.items.forEach(item => {
                const input = document.getElementById(item.id);
                if (input) {
                    answers[item.id] = (input.type === 'checkbox') ? input.checked : input.value;
                }
            });

            // Save answers to localStorage and proceed to the main survey
            localStorage.setItem('surveyAnswers', JSON.stringify(answers));
            window.location.href = 'q_page.html';
        });
    }

    // --- Start the Application ---
    initializeIntro();
});

