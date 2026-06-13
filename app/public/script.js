const API_URL = 'http://localhost:3000/api';
let sessionId = null;
let zIndexCounter = 100;

const inventory = document.getElementById('inventory');
const craftingArea = document.getElementById('crafting-area');
const objectivesList = document.getElementById('objectives-list');
const objectiveInput = document.getElementById('objective-input');
const setObjectivesBtn = document.getElementById('set-objectives-btn');
const toast = document.getElementById('toast');

// Initialize game
async function init() {
    try {
        const res = await fetch(`${API_URL}/session`, { method: 'POST' });
        const data = await res.json();
        sessionId = data.sessionId;
        
        data.elements.forEach(word => addElementToInventory(word));
    } catch (error) {
        showToast('Failed to connect to server');
        console.error(error);
    }
}

// Add element to inventory (bottom panel)
function addElementToInventory(word) {
    // Check if already in inventory to avoid duplicates
    const existing = Array.from(inventory.children).find(el => el.dataset.word === word);
    if (existing) return;

    const el = document.createElement('div');
    el.className = 'element';
    el.textContent = word;
    el.dataset.word = word;
    
    // Clicking adds a copy to the board
    el.addEventListener('pointerdown', (e) => {
        const boardEl = createBoardElement(word, e.clientX, e.clientY);
        startDrag(boardEl, e);
    });

    inventory.appendChild(el);
}

// Create an element on the main crafting board
function createBoardElement(word, x, y) {
    const el = document.createElement('div');
    el.className = 'element on-board';
    el.textContent = word;
    el.dataset.word = word;
    
    // Position it relative to the crafting area
    const parentRect = craftingArea.getBoundingClientRect();
    el.style.left = `${x - parentRect.left - 40}px`;
    el.style.top = `${y - parentRect.top - 20}px`;
    el.style.zIndex = ++zIndexCounter;

    el.addEventListener('pointerdown', (e) => startDrag(el, e));
    
    craftingArea.appendChild(el);
    return el;
}

// Drag and drop logic
function startDrag(element, event) {
    event.preventDefault();
    element.style.zIndex = ++zIndexCounter;
    
    // We use the pointer coordinates, and element width/height to center the drag.
    // However, if the element was just created, getBoundingClientRect() may not be accurate yet.
    const rect = element.getBoundingClientRect();
    
    // Default to roughly center if rect seems invalid (width=0 usually happens right after append)
    let shiftX = rect.width > 0 ? event.clientX - rect.left : 40;
    let shiftY = rect.height > 0 ? event.clientY - rect.top : 20;

    const parentRect = craftingArea.getBoundingClientRect();

    function moveAt(clientX, clientY) {
        let newLeft = clientX - shiftX - parentRect.left;
        let newTop = clientY - shiftY - parentRect.top;
        element.style.left = newLeft + 'px';
        element.style.top = newTop + 'px';
    }

    function onPointerMove(e) {
        moveAt(e.clientX, e.clientY);
        checkOverlap(element);
    }

    document.addEventListener('pointermove', onPointerMove);

    document.addEventListener('pointerup', async (e) => {
        document.removeEventListener('pointermove', onPointerMove);
        
        // Remove highlight from all
        document.querySelectorAll('.element.on-board').forEach(el => el.classList.remove('highlight'));

        const overlappedElement = getOverlappedElement(element);
        
        if (overlappedElement) {
            // Crafting attempt
            const word1 = element.dataset.word;
            const word2 = overlappedElement.dataset.word;
            
            // Visual feedback
            element.style.transform = 'scale(0)';
            overlappedElement.style.transform = 'scale(1.2)';
            
            setTimeout(() => {
                element.remove();
                overlappedElement.remove();
            }, 200);

            await craftWords(word1, word2, e.clientX, e.clientY);
        }
    }, { once: true });
}

// Check if overlapping and highlight
function checkOverlap(draggedEl) {
    const elements = document.querySelectorAll('.element.on-board');
    let foundOverlap = false;

    elements.forEach(el => {
        if (el === draggedEl) return;
        
        if (isOverlapping(draggedEl, el)) {
            el.classList.add('highlight');
            foundOverlap = true;
        } else {
            el.classList.remove('highlight');
        }
    });
}

function getOverlappedElement(draggedEl) {
    const elements = document.querySelectorAll('.element.on-board');
    for (let el of elements) {
        if (el !== draggedEl && isOverlapping(draggedEl, el)) {
            return el;
        }
    }
    return null;
}

function isOverlapping(el1, el2) {
    const rect1 = el1.getBoundingClientRect();
    const rect2 = el2.getBoundingClientRect();

    return !(
        rect1.right < rect2.left ||
        rect1.left > rect2.right ||
        rect1.bottom < rect2.top ||
        rect1.top > rect2.bottom
    );
}

// Crafting API call
async function craftWords(word1, word2, x, y) {
    try {
        const res = await fetch(`${API_URL}/craft`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionId, word1, word2 })
        });
        const data = await res.json();
        
        if (data.success) {
            const resultWord = data.word;
            // Spawn the new element at the drop location
            createBoardElement(resultWord, x, y);
            
            if (data.isNew) {
                addElementToInventory(resultWord);
                showToast(`Discovered: ${resultWord}!`);
                checkObjectives(resultWord);
            }
        } else {
            // Return elements to original position if failed (optional bounce effect)
            element.style.transform = 'scale(1)';
            overlappedElement.style.transform = 'scale(1)';
            showToast("Nothing happened");
        }
    } catch (error) {
        console.error(error);
    }
}

// Objectives Logic
setObjectivesBtn.addEventListener('click', async () => {
    const input = objectiveInput.value.trim();
    if (!input) return;
    
    const words = input.split(',').map(w => w.trim());
    
    try {
        await fetch(`${API_URL}/session/${sessionId}/objectives`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ objectives: words })
        });
        
        loadObjectives();
        objectiveInput.value = '';
    } catch (error) {
        console.error(error);
    }
});

async function loadObjectives() {
    try {
        const res = await fetch(`${API_URL}/session/${sessionId}/objectives`);
        const data = await res.json();
        
        objectivesList.innerHTML = '';
        data.forEach(obj => {
            const li = document.createElement('li');
            li.className = `objective-item ${obj.is_found ? 'found' : ''}`;
            li.dataset.target = obj.target_word;
            
            li.innerHTML = `
                <span>${obj.target_word}</span>
                ${obj.is_found ? '<span>✓</span>' : '<span>?</span>'}
            `;
            objectivesList.appendChild(li);
        });
    } catch (error) {
        console.error(error);
    }
}

function checkObjectives(word) {
    const items = document.querySelectorAll('.objective-item');
    items.forEach(item => {
        if (item.dataset.target === word && !item.classList.contains('found')) {
            item.classList.add('found');
            item.innerHTML = `
                <span>${word}</span>
                <span>✓</span>
            `;
            showToast(`Objective complete: ${word}!`);
        }
    });
}

// Utility
function showToast(message) {
    toast.textContent = message;
    toast.classList.remove('hidden');
    
    setTimeout(() => {
        toast.classList.add('hidden');
    }, 3000);
}

// Start game
init();
