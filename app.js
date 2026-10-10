// Tab navigation
const navLinks = document.querySelectorAll('.nav-link');
const panels = document.querySelectorAll('.panel');

navLinks.forEach(link => {
  link.addEventListener('click', (e) => {
    e.preventDefault();
    const target = link.dataset.target;

    navLinks.forEach(l => l.classList.remove('active'));
    link.classList.add('active');

    panels.forEach(p => p.classList.remove('active'));
    document.getElementById(target).classList.add('active');

    // Scroll to top of content on mobile
    if (window.innerWidth < 960) {
      document.querySelector('.content').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
});

// If URL has hash, open that panel on load
window.addEventListener('DOMContentLoaded', () => {
  const hash = window.location.hash.replace('#', '');
  if (hash) {
    const link = document.querySelector(`.nav-link[data-target="${hash}"]`);
    if (link) link.click();
  }
});
