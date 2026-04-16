let issues = JSON.parse(localStorage.getItem('scrum-issues')) || [];

function renderBoard() {
    document.querySelectorAll('.issue-list').forEach(list => list.innerHTML = '');
    issues.sort((a, b) => a.priority - b.priority);

    issues.forEach((issue, index) => {
        const card = document.createElement('div');
        card.className = `issue-card prio-${issue.priority}`;
        card.draggable = true;
        card.innerHTML = `
            <span>${issue.title}</span>
            <button class="delete-btn" onclick="deleteIssue(${index})">X</button>
        `;
        
        card.ondragstart = (e) => e.dataTransfer.setData("text", index);
        document.querySelector(`#${issue.status} .issue-list`).appendChild(card);
    });
    
    localStorage.setItem('scrum-issues', JSON.stringify(issues));
}

function addIssue() {
    const input = document.getElementById('taskInput');
    if(!input.value) return;
    issues.push({ title: input.value, priority: document.getElementById('priorityInput').value, status: 'open' });
    input.value = '';
    renderBoard();
}

function deleteIssue(index) {
    issues.splice(index, 1);
    renderBoard();
}

function allowDrop(ev) { ev.preventDefault(); }

function drop(ev) {
    ev.preventDefault();
    const index = ev.dataTransfer.getData("text");
    let target = ev.target;
    while (!target.classList.contains('column')) { target = target.parentElement; }
    issues[index].status = target.id;
    renderBoard();
}

renderBoard();