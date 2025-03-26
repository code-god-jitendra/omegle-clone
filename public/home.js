document.addEventListener('DOMContentLoaded', () => {
  // Hamburger menu toggle for mobile devices
  const hamburger = document.querySelector('.hamburger');
  const navLinks = document.querySelector('.nav-links');

  hamburger.addEventListener('click', () => {
    navLinks.classList.toggle('active');
  });

  // Hide the navigation menu when any nav link is clicked
  navLinks.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => {
      navLinks.classList.remove('active');
    });
  });

  // Disclaimer modal functionality
  const disclaimerModal = document.getElementById('disclaimerModal');
  const agreeBtn = document.getElementById('agreeBtn');

  // Show the disclaimer modal on page load
  window.addEventListener('load', () => {
    disclaimerModal.style.display = 'flex';
  });

  // When the user clicks "I Agree", hide the modal
  agreeBtn.addEventListener('click', () => {
    disclaimerModal.style.display = 'none';
  });

  // Chat mode buttons
  document.getElementById('videoModeBtn').addEventListener('click', () => {
    window.location.href = 'video.html';
  });

  document.getElementById('textModeBtn').addEventListener('click', () => {
    window.location.href = 'text.html';
  });
});
