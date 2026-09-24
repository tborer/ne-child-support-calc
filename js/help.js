// Help link + modal, shared by every page. Adds a "Help" button to the
// primary nav (after Guidelines) that opens a <dialog> form; submissions go
// to POST /api/help, which emails them via SMTP.
(function () {
  'use strict';

  var nav = document.querySelector('.site-nav .nav-inner');
  if (!nav || !window.HTMLDialogElement) return;

  var trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.className = 'nav-help';
  trigger.id = 'help-open';
  trigger.setAttribute('aria-haspopup', 'dialog');
  trigger.textContent = 'Help';
  nav.appendChild(trigger);

  var dialog = document.createElement('dialog');
  dialog.className = 'help-dialog';
  dialog.id = 'help-dialog';
  dialog.setAttribute('aria-labelledby', 'help-title');
  dialog.innerHTML =
    '<form class="help-form" novalidate>' +
      '<div class="help-header">' +
        '<h2 id="help-title">How can we help?</h2>' +
        '<button type="button" class="help-close" aria-label="Close">&times;</button>' +
      '</div>' +
      '<p class="help-intro">Questions, problems with a payment, or feedback. ' +
        'Add your email if you would like a reply. Please don’t include case numbers or other private details.</p>' +
      '<label for="help-message">Message <span aria-hidden="true">*</span></label>' +
      '<textarea id="help-message" name="message" rows="6" maxlength="5000" required></textarea>' +
      '<div class="help-row">' +
        '<div><label for="help-name">Name <span class="help-optional">(optional)</span></label>' +
        '<input id="help-name" name="name" type="text" maxlength="200" autocomplete="name"></div>' +
        '<div><label for="help-email">Email <span class="help-optional">(optional, for a reply)</span></label>' +
        '<input id="help-email" name="email" type="email" maxlength="200" autocomplete="email"></div>' +
      '</div>' +
      // Honeypot for bots; hidden from people and assistive tech.
      '<div class="help-hp" aria-hidden="true"><label for="help-website">Website</label>' +
        '<input id="help-website" name="website" type="text" tabindex="-1" autocomplete="off"></div>' +
      '<p class="help-status" role="status" aria-live="polite"></p>' +
      '<div class="help-actions">' +
        '<button type="button" class="help-cancel">Cancel</button>' +
        '<button type="submit" class="help-submit">Send message</button>' +
      '</div>' +
    '</form>';
  document.body.appendChild(dialog);

  var form = dialog.querySelector('form');
  var message = dialog.querySelector('#help-message');
  var status = dialog.querySelector('.help-status');
  var submit = dialog.querySelector('.help-submit');

  function setStatus(text, kind) {
    status.textContent = text || '';
    status.className = 'help-status' + (kind ? ' help-status--' + kind : '');
  }

  function open() {
    setStatus('');
    form.hidden = false;
    submit.disabled = false;
    dialog.showModal();
    message.focus();
  }

  function close() { dialog.close(); }

  trigger.addEventListener('click', open);
  dialog.querySelector('.help-close').addEventListener('click', close);
  dialog.querySelector('.help-cancel').addEventListener('click', close);
  // Click on the backdrop closes the dialog.
  dialog.addEventListener('click', function (event) {
    if (event.target === dialog) close();
  });

  form.addEventListener('submit', function (event) {
    event.preventDefault();
    if (!message.value.trim()) {
      setStatus('Please enter a message.', 'error');
      message.focus();
      return;
    }
    var email = form.elements.email;
    if (email.value && !email.checkValidity()) {
      setStatus('Please enter a valid email address, or leave it blank.', 'error');
      email.focus();
      return;
    }

    submit.disabled = true;
    setStatus('Sending…');
    fetch('api/help', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: message.value,
        name: form.elements.name.value,
        email: email.value,
        website: form.elements.website.value,
        page: window.location.pathname,
      }),
    })
      .then(function (response) {
        return response.json().catch(function () { return {}; }).then(function (data) {
          if (!response.ok) throw new Error(data.message || 'Sorry, your message could not be sent.');
        });
      })
      .then(function () {
        form.reset();
        setStatus('Thanks! Your message has been sent.', 'success');
        submit.disabled = false;
      })
      .catch(function (err) {
        submit.disabled = false;
        setStatus(err && err.message && err.message !== 'Failed to fetch'
          ? err.message
          : 'Could not reach the server. Check your connection and try again.', 'error');
      });
  });
})();
