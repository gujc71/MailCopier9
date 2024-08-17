let mailboxList4Source = {};

window.electron.ipcRenderer.on('connectSource', (event, mailboxes) => {
	if (mailboxes.error) {
		alert("There seems to be an issue with mail server connection.\nPlease verify your connection information.");
		return;
	}
	addLogger("Connected Source Mail Server");

	document.getElementById('connectSource').textContent = "Disconnect";

	mailboxList4Source = {};

	const mailboxesList = document.getElementById('mailboxMapper');
	mailboxesList.innerHTML = "";
	
	for (const mailbox of mailboxes) {
		const row = appendRow(mailboxesList);
		mailboxList4Source[mailbox.name] = row;
		
		row.cells[0].style.textAlign="left";
		row.cells[0].textContent = mailbox.name; 
		row.cells[1].textContent = mailbox.messages; 

		const checkbox = document.createElement("input");
		checkbox.type = "checkbox";
		checkbox.value = mailbox.name;
		row.cells[2].appendChild(checkbox);
	}
});

window.electron.ipcRenderer.on('connectTarget', (event, mailboxes) => {
	if (mailboxes.error) {
		alert("There seems to be an issue with mail server connection.\nPlease verify your connection information.");
		return;
	}
	addLogger("Connected Target Mail Server");

	document.getElementById('connectTarget').textContent = "Disconnect";

	// remove all & init
	const selectTargetMailbox = document.getElementById('selectTargetMailbox');
	selectTargetMailbox.innerHTML="";
	appendSelectOption(selectTargetMailbox, "Same as Source");		

	const mailboxesList = document.getElementById('mailboxMapper');
	
	// Check if the same mailbox exists in SOURCE and if so, show it in the same row
	for (const mailboxPath of mailboxes) {
		appendSelectOption(selectTargetMailbox, mailboxPath.name, mailboxPath.messages);
		
		const row = mailboxList4Source[mailboxPath.name];
		if (!row) continue;
		
		row.cells[3].style.textAlign="left";
		row.cells[3].textContent = mailboxPath.name;
		row.cells[4].textContent = mailboxPath.messages;
	}
	// If no mailbox with the same name exists in SOURCE, set to "⇒". (it means create with the same name as SOURCE)
	for (var i = 0; i < mailboxesList.rows.length; i++) {
		var row = mailboxesList.rows[i];
		if (!row.cells[3].innerText) {
			row.cells[3].textContent = "⇒";
			row.cells[3].title = "Same as Source";
		}
	}
});

window.electron.ipcRenderer.on('logMessage', (event, message) => {
	addLogger(message);
});

// ---------------------------------------------------------
function appendRow(parentNode, id) {
	const row = document.createElement('tr');
	if (id) row.id = id;
	parentNode.appendChild(row);

	for(let i = 0; i<5; i++){
		const td = document.createElement('td');
		row.appendChild(td);
	}		
		
	return row;
}		

function appendSelectOption(parentNode, value, count) {
	var newOption = document.createElement('option');
	newOption.value = value;
	newOption.textContent = value;
	if (!count) count=0;
	newOption.dataset.count = count;

	parentNode.appendChild(newOption);
}  
	
function addLogger(msg, cssClass) {
	var span = document.createElement('span');
	span.innerHTML = msg;
	if (cssClass) span.classList.add(cssClass);

	document.getElementById('logDiv').appendChild(span);
}
