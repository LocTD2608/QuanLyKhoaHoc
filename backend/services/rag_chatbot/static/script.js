document.addEventListener('DOMContentLoaded', () => {
    const chatMessages = document.getElementById('chat-messages');
    const userInput = document.getElementById('user-input');
    const sendBtn = document.getElementById('send-btn');
    const citationsList = document.getElementById('citations-list');
    const clearChatBtn = document.getElementById('clear-chat');

    function escapeHtml(text) {
        return String(text)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function formatInline(text) {
        let html = escapeHtml(text);
        html = html.replace(
            /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
            '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>'
        );
        html = html.replace(
            /(^|[\s(])(https?:\/\/[^\s<]+)/g,
            (match, prefix, url) => `${prefix}<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`
        );
        return html;
    }

    function formatMultiline(text) {
        return String(text)
            .split('\n')
            .map((line) => formatInline(line))
            .join('<br>');
    }

    // Auto-resize textarea
    userInput.addEventListener('input', function() {
        this.style.height = 'auto';
        this.style.height = (this.scrollHeight) + 'px';
    });

    // Handle Send Message
    async function sendMessage() {
        const message = userInput.value.trim();
        if (!message) return;

        // Clear input and reset height
        userInput.value = '';
        userInput.style.height = 'auto';

        // Add user message to UI
        addMessage(message, 'user');

        // Add loading state
        const loadingMsg = addLoadingMessage();
        
        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message })
            });

            if (!response.ok) throw new Error('Network response was not ok');

            const data = await response.json();
            
            // Remove loading and add assistant message
            loadingMsg.remove();
            addMessage(data.answer, 'assistant');
            
            // Update citations
            updateCitations(data.citations);

        } catch (error) {
            console.error('Error:', error);
            loadingMsg.remove();
            addMessage('Đã xảy ra lỗi khi kết nối với máy chủ. Vui lòng thử lại sau.', 'assistant');
        }
    }

    function addMessage(text, role) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${role}`;

        messageDiv.innerHTML = `
            <div class="message-content">
                ${formatMultiline(text)}
            </div>
        `;
        
        chatMessages.appendChild(messageDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
        return messageDiv;
    }

    function addLoadingMessage() {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message assistant loading';
        messageDiv.innerHTML = `
            <div class="message-content">
                <div class="typing">
                    <span></span><span></span><span></span>
                </div>
            </div>
        `;
        chatMessages.appendChild(messageDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
        return messageDiv;
    }

    function updateCitations(citations) {
        if (!citations || citations.length === 0) {
            citationsList.innerHTML = `
                <div class="empty-citations">
                    <i class="fas fa-search"></i>
                    <p>Không có trích dẫn trực tiếp cho câu hỏi này.</p>
                </div>
            `;
            return;
        }

        citationsList.innerHTML = '';
        citations.forEach((cit, index) => {
            const card = document.createElement('div');
            card.className = 'citation-card';

            const meta = cit.metadata;
            const sourceTitle = meta.ten_tap_chi || meta.source || meta.source_file || 'Nguồn pháp lý';
            const details = Object.entries(meta)
                .filter(([k]) => !['embedding', 'source'].includes(k));

            const source = document.createElement('span');
            source.className = 'source';
            source.textContent = `[${index + 1}] ${sourceTitle}`;
            card.appendChild(source);

            const content = document.createElement('div');
            content.className = 'content';
            details.forEach(([k, v], detailIndex) => {
                const row = document.createElement('div');
                row.innerHTML = `<strong>${escapeHtml(k)}:</strong> ${formatInline(String(v))}`;
                content.appendChild(row);
                if (detailIndex < details.length - 1) {
                    content.appendChild(document.createElement('br'));
                }
            });

            card.appendChild(content);
            citationsList.appendChild(card);
        });
    }

    // Event Listeners
    sendBtn.addEventListener('click', sendMessage);
    userInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    clearChatBtn.addEventListener('click', () => {
        chatMessages.innerHTML = `
            <div class="message system">
                <div class="message-content">
                    Lịch sử trò chuyện đã được xóa. Tôi có thể giúp gì thêm cho bạn?
                </div>
            </div>
        `;
        citationsList.innerHTML = `
            <div class="empty-citations">
                <i class="fas fa-search"></i>
                <p>Các trích dẫn pháp lý sẽ hiển thị tại đây sau khi AI trả lời.</p>
            </div>
        `;
    });
});
