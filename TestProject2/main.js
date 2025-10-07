document.addEventListener('DOMContentLoaded', function () {
  // --- "I Accept" Checkbox Logic for disclaimer.html ---
  const checkbox = document.getElementById('Terms_And_Conditions_Checkbox');
  const nextButton = document.getElementById('next-button');

  if (checkbox && nextButton) {
    // Disable the button so the user can't just go next
    nextButton.disabled = !checkbox.checked;

    // Add an event listener (essentially constantly checks whether the checkbox has been ticked)
    checkbox.addEventListener('change', function () {
      nextButton.disabled = !this.checked;
    });

    // If the button isn't disabled then go to the next page
    nextButton.addEventListener('click', function () {
      if (!this.disabled) {
        window.location.href = 'questions.html';
      }
    });
  }
});
