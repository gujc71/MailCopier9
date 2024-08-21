window.onload = () => {
	document.getElementById('connectSource').addEventListener('click', connectSource);
	document.getElementById('connectTarget').addEventListener('click', connectTarget);
	document.getElementById('copyMails').addEventListener('click', copyMails);

	document.getElementById('mailboxMapper').addEventListener('click', ev_changeSelectMailbox);
	document.getElementById('selectAllSourceMailBox').addEventListener('click', ev_selectAllSourceMailBox);
}

function connectSource() {
	if (document.getElementById('connectSource').textContent === "Disconnect") {
		window.electron.ipcRenderer.send('disconnectSource');
		document.getElementById('connectSource').textContent = "Connect Source";

		document.body.appendChild(document.getElementById('selectTargetMailbox'));

		document.getElementById("mailboxMapper").innerHTML="";
		addLogger("Disconnected Source Mail Server");		
		return;
	}

	const sourceConfig = {
		user: document.getElementById('sourceUser').value,
		password: document.getElementById('sourcePassword').value,
		host: document.getElementById('sourceHost').value,
		port: parseInt(document.getElementById('sourcePort').value, 10),
		tls: document.getElementById('sourceSSL').checked
	};

	window.electron.ipcRenderer.send('connectSource', sourceConfig);
}

function connectTarget() {
	if (document.getElementById('connectTarget').textContent === "Disconnect") {
		window.electron.ipcRenderer.send('disconnectTarget');
		document.getElementById('connectTarget').textContent = "Connect Destination";
		const selectTargetMailbox = document.getElementById("selectTargetMailbox");	
		document.body.appendChild(selectTargetMailbox);
		selectTargetMailbox.innerHTML="";
		const rows = document.getElementById('mailboxMapper').querySelectorAll('tr');
		rows.forEach(row => {
			row.cells[3].textContent = "";
		})
		addLogger("Disconnected Target Mail Server");		
		return;
	}

	const destConfig = {
		user: document.getElementById('destUser').value,
		password: document.getElementById('destPassword').value,
		host: document.getElementById('destHost').value,
		port: parseInt(document.getElementById('destPort').value, 10),
		tls: document.getElementById('destSSL').checked
	};

	window.electron.ipcRenderer.send('connectTarget', destConfig);
};

function copyMails() {
	const startDate = document.getElementById('start-date').value || null;
	const endDate   = document.getElementById('end-date').value || null;
	const checkboxes = mailboxMapper.querySelectorAll("input[type='checkbox']");
	const mailboxMapper = document.getElementById("mailboxMapper");
	mailboxMapper.firstChild.firstChild.click();  // selectTargetMailbox hide

	const selectedMailboxList = [];
	checkboxes.forEach(function(checkbox) {
		if (!checkbox.checked) return;
		const row = checkbox.parentNode.parentNode;
		selectedMailboxList.push({ "source": row.cells[0].textContent, "target": row.cells[3].textContent });
	});

	if (selectedMailboxList.length===0) {
		alert("Select the mailboxes you want to copy.");
		return;
	}

	window.electron.ipcRenderer.send('RunCopyEmails', selectedMailboxList, startDate, endDate);
}

function ev_changeSelectMailbox (event) {
	const cell = event.target;
	const selectTargetMailbox = document.getElementById('selectTargetMailbox');
	if (!selectTargetMailbox.options || selectTargetMailbox.options.length===0 || cell.tagName !== 'TD') return; // selectTargetMailbox clicked

	const currentCell = selectTargetMailbox.parentNode;
	if (currentCell.tagName === 'TD' && currentCell.cellIndex===3) {  // 기존 선택 값을 기존 cell에 설정
		//parentNode.textContent = selectTargetMailbox.selectedIndex === 0 ? "⇒" : selectTargetMailbox.value;
		if (selectTargetMailbox.selectedIndex === 0 ) {
			currentCell.textContent = "⇒";
			currentCell.parentNode.cells[4].innerHTML = "";
		} else {
			currentCell.textContent = selectTargetMailbox.value;
			currentCell.parentNode.cells[4].innerHTML = selectTargetMailbox.options[selectTargetMailbox.selectedIndex].dataset.count;
		}
	}

	selectTargetMailbox.classList.remove("activate");
	document.body.appendChild(selectTargetMailbox);
	if (cell.cellIndex===3) {                                       // 현재 cell에 selectTargetMailbox 출력
		if (cell.textContent==="⇒") selectTargetMailbox.selectedIndex = 0;
		else selectTargetMailbox.value = cell.textContent;
		
		cell.textContent = "";
		cell.appendChild(selectTargetMailbox);
		selectTargetMailbox.classList.add("activate");
	}
}

function ev_selectAllSourceMailBox () {
	const selectAllSourceMailBox = document.getElementById("selectAllSourceMailBox");
	const chk = selectAllSourceMailBox.checked;

	const mailboxMapper = document.getElementById("mailboxMapper");
	const checkboxes = mailboxMapper.querySelectorAll("input[type='checkbox']");
	checkboxes.forEach(function(checkbox) {
		checkbox.checked = chk;
	});
}    
