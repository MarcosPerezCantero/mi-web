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

// Infrastructure: architecture diagram
const nodes = {
  push:    { title: 'git push', text: 'Changes are committed locally and pushed to the main branch. That single command is the whole release process.', tags: ['Git', 'main branch'] },
  github:  { title: 'GitHub repository', text: 'Single source of truth for the site and its infrastructure config. TLS material and secrets are never committed.', tags: ['Version control', '.gitignore', 'Audit trail'] },
  actions: { title: 'GitHub Actions', text: 'An ephemeral runner validates the deploy key, guards the target directory, syncs files over SSH and rebuilds the containers. Runs are queued so deploys never overlap.', tags: ['CI/CD', 'Encrypted secrets', 'Pinned host key'] },
  vps:     { title: 'OVH VPS', text: 'Ubuntu server managed end to end: key-only SSH, a dedicated user for Docker and a Compose project that owns every service.', tags: ['Ubuntu', 'Docker Compose', 'Hardened SSH'] },
  visitor: { title: 'Browser', text: 'Every request is forced onto HTTPS. Plain HTTP only answers the ACME challenge and a 301 redirect.', tags: ['HTTPS only', '301 redirect'] },
  dns:     { title: 'DNS', text: 'The apex and www records point to the VPS public address.', tags: ['A records', 'apex + www'] },
  proxy:   { title: 'nginx reverse proxy', text: 'The only container exposed to the internet. Terminates TLS on :443 and forwards traffic to the app over the internal Docker network.', tags: ['nginx', 'TLS termination', 'proxy_pass'] },
  web:     { title: 'web container', text: 'nginx:alpine with the static site baked into the image at build time. Not reachable from outside the Docker network.', tags: ['nginx:alpine', 'Immutable image', 'Internal only'] },
  certbot: { title: 'Certbot', text: 'Requests and renews certificates using the webroot method; the proxy serves the challenge files. Certificates stay on the server only.', tags: ['Certbot', 'Webroot', 'Host volume'] },
  le:      { title: "Let's Encrypt", text: 'Free, automated certificate authority. Issues 90-day certificates after verifying domain control over HTTP.', tags: ['ACME', '90-day certs'] }
};

const flowNodes = document.querySelectorAll('.flow-node');
const detail = document.getElementById('node-detail');

function showNode(id) {
  const n = nodes[id];
  if (!n || !detail) return;
  flowNodes.forEach(b => b.classList.toggle('active', b.dataset.node === id));
  detail.querySelector('h4').textContent = n.title;
  detail.querySelector('p').textContent = n.text;
  detail.querySelector('.stack').innerHTML = n.tags.map(t => `<span>${t}</span>`).join('');
}

flowNodes.forEach(b => b.addEventListener('click', () => {
  showNode(b.dataset.node);
  if (window.innerWidth < 720) detail.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}));
showNode('push');

// Infrastructure: live data written by the deploy pipeline
function timeAgo(date) {
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  const s = Math.round((date - Date.now()) / 1000);
  const units = [['day', 86400], ['hour', 3600], ['minute', 60]];
  for (const [unit, secs] of units) {
    if (Math.abs(s) >= secs) return rtf.format(Math.round(s / secs), unit);
  }
  return 'just now';
}

fetch('build-info.json', { cache: 'no-store' })
  .then(r => (r.ok ? r.json() : Promise.reject()))
  .then(info => {
    if (info.deployed_at) {
      const el = document.getElementById('bi-deployed');
      el.textContent = timeAgo(new Date(info.deployed_at));
      el.classList.add('ok');
      el.title = new Date(info.deployed_at).toUTCString();
    }
    if (info.commit) {
      const link = document.getElementById('bi-commit');
      link.textContent = `commit ${info.commit}`;
      if (info.run_url) link.href = info.run_url;
    }
    if (info.tls_expires) {
      const exp = new Date(info.tls_expires);
      const days = Math.floor((exp - Date.now()) / 86400000);
      document.getElementById('bi-tls').textContent = days >= 0 ? `valid · ${days} days left` : 'expired';
      document.getElementById('bi-tls-sub').textContent =
        `Let's Encrypt · until ${exp.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`;
    }
  })
  .catch(() => {});
