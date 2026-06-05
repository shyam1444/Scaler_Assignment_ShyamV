document.addEventListener('DOMContentLoaded', () => {
  // DOM Elements
  const chatHistory = document.getElementById('chat-history');
  const chatInput = document.getElementById('chat-input');
  const sendBtn = document.getElementById('send-btn');
  const quickChips = document.querySelectorAll('.prompt-chip');
  
  const bookingDateInput = document.getElementById('booking-date');
  const slotsGrid = document.getElementById('slots-grid');
  
  const telemetryToggle = document.getElementById('telemetry-toggle');
  const telemetryPanel = document.querySelector('.telemetry-panel');
  const statRagLatency = document.getElementById('stat-rag-latency');
  const statLlmLatency = document.getElementById('stat-llm-latency');
  const statChunksCount = document.getElementById('stat-chunks-count');
  const sourcesList = document.getElementById('sources-list');

  const bookingModal = document.getElementById('booking-modal');
  const closeModalBtn = document.getElementById('close-modal');
  const bookingForm = document.getElementById('booking-form');
  const modalSelectedTime = document.getElementById('modal-selected-time');
  const bookingTimeIso = document.getElementById('booking-time-iso');
  
  // Chat History State
  const conversationMessages = [
    { role: 'assistant', content: "Hello! I am Shyam's official AI representative. I am grounded directly on his resume credentials and his 23 public GitHub repositories." }
  ];

  // Set default date input to tomorrow's date
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().substring(0, 10);
  bookingDateInput.value = tomorrowStr;
  bookingDateInput.min = new Date().toISOString().substring(0, 10);
  
  // Fetch slots initially for tomorrow
  fetchSlots(tomorrowStr);

  // Event Listeners
  sendBtn.addEventListener('click', sendMessage);
  chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendMessage();
  });

  quickChips.forEach(chip => {
    chip.addEventListener('click', () => {
      const query = chip.getAttribute('data-query');
      chatInput.value = query;
      sendMessage();
    });
  });

  bookingDateInput.addEventListener('change', (e) => {
    fetchSlots(e.target.value);
  });

  telemetryToggle.addEventListener('click', () => {
    telemetryPanel.classList.toggle('expanded');
  });

  closeModalBtn.addEventListener('click', hideBookingModal);
  window.addEventListener('click', (e) => {
    if (e.target === bookingModal) hideBookingModal();
  });

  bookingForm.addEventListener('submit', handleBookingSubmit);

  // Functions

  /**
   * Helper to format simple markdown strings into HTML paragraphs/bullets
   */
  function formatMarkdown(text) {
    if (typeof marked !== 'undefined') {
      try {
        marked.setOptions({
          breaks: true,
          gfm: true
        });
        return marked.parse(text);
      } catch (e) {
        console.error("Marked parsing failed, falling back", e);
      }
    }

    // Escape HTML to prevent injections
    let safe = text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

    // Replace bold text **word**
    safe = safe.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

    // Replace inline code `word`
    safe = safe.replace(/`(.*?)`/g, '<code class="inline-code">$1</code>');

    // Split by newlines
    const lines = safe.split('\n');
    let html = '';
    let inList = false;

    for (let line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      // Handle Headers
      if (trimmed.startsWith('###')) {
        if (inList) {
          html += '</ul>';
          inList = false;
        }
        html += `<h3>${trimmed.replace(/^###\s*/, '')}</h3>`;
      } 
      // Handle Separators
      else if (trimmed === '---') {
        if (inList) {
          html += '</ul>';
          inList = false;
        }
        html += '<hr class="chat-hr">';
      }
      // Handle Bullet Lists
      else if (trimmed.startsWith('-') || trimmed.startsWith('*')) {
        if (!inList) {
          html += '<ul>';
          inList = true;
        }
        const itemText = trimmed.replace(/^[-*]\s*/, '');
        html += `<li>${itemText}</li>`;
      } 
      // Handle Paragraphs
      else {
        if (inList) {
          html += '</ul>';
          inList = false;
        }
        html += `<p>${trimmed}</p>`;
      }
    }

    if (inList) {
      html += '</ul>';
    }

    return html;
  }

  /**
   * Appends a message bubble to the chat panel
   */
  function appendMessage(role, text, isToolSuccess = false) {
    const msgDiv = document.createElement('div');
    msgDiv.classList.add('message', `${role}-message`);

    const avatar = document.createElement('div');
    avatar.classList.add('msg-avatar');
    avatar.innerHTML = role === 'user' ? '<i class="fa-solid fa-user"></i>' : '<i class="fa-solid fa-robot"></i>';

    const content = document.createElement('div');
    content.classList.add('msg-content');
    content.innerHTML = formatMarkdown(text);

    if (isToolSuccess) {
      const toolBadge = document.createElement('div');
      toolBadge.classList.add('system-tag', 'success');
      toolBadge.innerHTML = '<i class="fa-solid fa-circle-check"></i> Interview Scheduled Successfully';
      content.appendChild(toolBadge);
    }

    msgDiv.appendChild(avatar);
    msgDiv.appendChild(content);
    chatHistory.appendChild(msgDiv);
    chatHistory.scrollTop = chatHistory.scrollHeight;
  }

  /**
   * Appends and returns a typing indicator bubble
   */
  function showTypingIndicator() {
    const indicatorDiv = document.createElement('div');
    indicatorDiv.classList.add('message', 'assistant-message', 'typing-container');

    const avatar = document.createElement('div');
    avatar.classList.add('msg-avatar');
    avatar.innerHTML = '<i class="fa-solid fa-robot"></i>';

    const content = document.createElement('div');
    content.classList.add('msg-content');
    content.innerHTML = `
      <div class="typing-indicator">
        <span class="typing-dot"></span>
        <span class="typing-dot"></span>
        <span class="typing-dot"></span>
      </div>
    `;

    indicatorDiv.appendChild(avatar);
    indicatorDiv.appendChild(content);
    chatHistory.appendChild(indicatorDiv);
    chatHistory.scrollTop = chatHistory.scrollHeight;
    return indicatorDiv;
  }

  /**
   * Main send message trigger
   */
  async function sendMessage() {
    const text = chatInput.value.trim();
    if (!text) return;

    chatInput.value = '';
    appendMessage('user', text);
    conversationMessages.push({ role: 'user', content: text });

    const typingBubble = showTypingIndicator();

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ messages: conversationMessages })
      });

      if (!response.ok) {
        throw new Error('API server returned error status.');
      }

      const data = await response.json();
      
      // Remove typing bubble
      typingBubble.remove();

      const isBookingSuccess = data.executedTool && data.executedTool.name === 'bookMeeting' && data.executedTool.result.success;
      
      appendMessage('assistant', data.message, isBookingSuccess);
      conversationMessages.push({ role: 'assistant', content: data.message });

      // Refresh availability slots if booking occurred
      if (isBookingSuccess) {
        fetchSlots(bookingDateInput.value);
      }

      // Update RAG Telemetry Panel
      updateTelemetry(data);

    } catch (error) {
      console.error(error);
      typingBubble.remove();
      appendMessage('assistant', "I apologize, but I've encountered a connection issue communicating with my backend. Please check if the server is running.");
    }
  }

  /**
   * Updates the RAG Debug Console fields
   */
  function updateTelemetry(data) {
    statRagLatency.textContent = data.ragLatencyMs ? `${data.ragLatencyMs} ms` : '0 ms';
    statLlmLatency.textContent = data.llmLatencyMs ? `${data.llmLatencyMs} ms` : 'N/A';
    
    const count = data.debug ? data.debug.length : 0;
    statChunksCount.textContent = `${count} chunks`;

    sourcesList.innerHTML = '';
    if (data.sources && data.sources.length > 0) {
      data.sources.forEach(src => {
        const li = document.createElement('li');
        li.classList.add(src.startsWith('Resume') ? 'source-resume' : 'source-github');
        li.textContent = src;
        sourcesList.appendChild(li);
      });
      // Expand debugger on first API request to show RAG capability
      telemetryPanel.classList.add('expanded');
    } else {
      sourcesList.innerHTML = '<li class="empty-source">No RAG references retrieved.</li>';
    }
  }

  /**
   * Fetches free slots for the given date
   */
  async function fetchSlots(date) {
    slotsGrid.innerHTML = '';
    const placeholder = document.createElement('p');
    placeholder.classList.add('slots-placeholder');
    placeholder.textContent = 'Checking availability...';
    slotsGrid.appendChild(placeholder);

    try {
      const response = await fetch(`/api/calendar/slots?date=${date}`);
      if (!response.ok) throw new Error();
      const data = await response.json();

      slotsGrid.innerHTML = '';
      if (!data.slots || data.slots.length === 0) {
        slotsGrid.innerHTML = '<p class="slots-placeholder">No slots available for this day. (Weekend or Fully Booked)</p>';
        return;
      }

      data.slots.forEach(slot => {
        const btn = document.createElement('button');
        btn.classList.add('slot-btn');
        btn.innerHTML = `
          <span>${slot.displayTime.split(' at ')[1]}</span>
          <i class="fa-regular fa-circle-right"></i>
        `;
        
        if (!slot.available) {
          btn.disabled = true;
          btn.style.opacity = '0.4';
          btn.style.cursor = 'not-allowed';
          btn.querySelector('span').textContent += ' (Booked)';
        } else {
          btn.addEventListener('click', () => showBookingModal(slot.displayTime, slot.time));
        }

        slotsGrid.appendChild(btn);
      });
    } catch {
      slotsGrid.innerHTML = '<p class="slots-placeholder">Error loading schedule. Verify server connection.</p>';
    }
  }

  // Booking Modal Handlers

  function showBookingModal(displayTime, isoTime) {
    modalSelectedTime.textContent = displayTime;
    bookingTimeIso.value = isoTime;
    bookingModal.classList.add('active');
  }

  function hideBookingModal() {
    bookingModal.classList.remove('active');
    bookingForm.reset();
  }

  /**
   * Booking submit action
   */
  async function handleBookingSubmit(e) {
    e.preventDefault();

    const name = document.getElementById('booker-name').value;
    const email = document.getElementById('booker-email').value;
    const notes = document.getElementById('booking-notes').value;
    const time = bookingTimeIso.value;

    const submitBtn = bookingForm.querySelector('.submit-booking-btn');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Scheduling...';

    try {
      const response = await fetch('/api/calendar/book', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ name, email, time, notes })
      });

      const data = await response.json();
      
      hideBookingModal();
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<i class="fa-regular fa-calendar-check"></i> Confirm Booking';

      if (data.success) {
        appendMessage('assistant', `I have booked the interview session for you! \n\n**Recruiter Name:** ${name}\n**Scheduled Time:** ${new Date(time).toLocaleString()}\n**Details:** ${data.message}`, true);
        fetchSlots(bookingDateInput.value);
      } else {
        appendMessage('assistant', `Failed to book slot: ${data.message}`);
      }

    } catch {
      hideBookingModal();
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<i class="fa-regular fa-calendar-check"></i> Confirm Booking';
      appendMessage('assistant', "I was unable to complete the booking due to a connection failure. Please try again.");
    }
  }
});
