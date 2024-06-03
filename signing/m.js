let _location = null; // Переменная для хранения координат
// const _baseUrl = "http://192.168.0.12:5001/pulltail-admin/us-central1/publicApi";
const _baseUrl = "https://us-central1-pulltail-admin.cloudfunctions.net/publicApi";

document.addEventListener('DOMContentLoaded', async () => {
    const pdfContainer = document.getElementById('pdfContainer');
    const gpsRequest = document.getElementById('gpsRequest');
    const gpsDenied = document.getElementById('gpsDenied');
    const requestGPSButton = document.getElementById('requestGPS');

    // Function to handle GPS access request
    async function requestGPSAccess() {
        try {
            _location = await getCoordinates();
            if (_location) {
                gpsRequest.style.display = 'none';
                pdfContainer.style.display = 'block';
                initPDFViewer(); // Initialize PDF viewer after getting GPS access
            } else {
                gpsRequest.style.display = 'none';
                gpsDenied.style.display = 'flex';
            }
        } catch (error) {
            console.error('Error getting GPS access:', error);
            gpsRequest.style.display = 'none';
            gpsDenied.style.display = 'flex'; // Меняем на flex
        }
    }

    // Function to check GPS permission status
    async function checkGPSPermission() {
        try {
            const permission = await navigator.permissions.query({ name: 'geolocation' });
            if (permission.state === 'granted') {
                console.log("Granted");
                // If permission is already granted, get coordinates and show PDF
                _location = await getCoordinates();
                gpsRequest.style.display = 'none';
                gpsDenied.style.display = 'none';
                pdfContainer.style.display = 'block';
                initPDFViewer();
            } else if (permission.state === 'prompt') {
                console.log("Promt");
                // If permission is not granted, show GPS request
                // gpsRequest.style.display = 'block';
                gpsRequest.style.display = 'flex';
                gpsDenied.style.display = 'none';
            } else {
                console.log("Else...");
                // If permission is denied, show GPS denied message
                gpsDenied.style.display = 'flex'; // Меняем на flex
            }
        } catch (error) {
            console.error('Error checking GPS permission:', error);
            gpsDenied.style.display = 'flex'; // Меняем на flex
        }
    }

    // Event listener for the GPS request button
    requestGPSButton.addEventListener('click', requestGPSAccess);

    // Initial GPS access request on page load
    checkGPSPermission();
});

async function initPDFViewer() {
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.5.207/pdf.worker.min.js';

    const pdfViewer = document.getElementById('pdfViewer');
    pdfViewer.style.display = 'none';
    const signaturePadCanvas = document.getElementById('signaturePadModal');
    const signaturePadModal = new SignaturePad(signaturePadCanvas, {
        minWidth: 1.5,
        maxWidth: 1.5,
        penColor: 'black'
    });
    const signatureModal = $('#signatureModal');
    const fullNameInput = document.getElementById('fullName');
    const initialsInput = document.getElementById('initials');

    // Обновляем размер canvas при показе модального окна
    $('#signatureModal').on('shown.bs.modal', function () {
        signaturePadModal.clear(); // Очистка подписи при каждом открытии модального окна
        signaturePadModal.on();
    });

    const loader = document.getElementById('loader');
    const overlay = document.getElementById('overlay');
    const startFinishBtn = document.getElementById('startFinishBtn');

    // 
    let pdfDoc = null;
    let signCoordinates = [];
    let signatures = [];
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code'); // Получение параметра code из URL

    let response;
    try {
        // Показываем лоадер и оверлей
        overlay.style.display = 'block';
        loader.style.display = 'block';
        response = await fetch(`${_baseUrl}/signingTest?code=${code}`);
        pdfViewer.style.display = 'block';
    } catch (error) {
        console.log("Error load PDF");
    }

    // Показываем лоадер и оверлей
    overlay.style.display = 'none';
    loader.style.display = 'none';

    const result = await response.json();
    const pdfBase64 = result.data.pdf;
    signCoordinates = result.data.signCoords;
    const envId = result.data.envId;

    const signerName = result.data.signerName; // Получаем имя подписанта
    fullNameInput.value = signerName;
    initialsInput.value = signerName.split(' ').map(name => name[0]).join('');

    loader.style.display = 'block';
    const pdfBytes = Uint8Array.from(atob(pdfBase64), c => c.charCodeAt(0));
    pdfjsLib.getDocument({ data: pdfBytes }).promise.then(pdf => {
        pdfDoc = pdf;
        renderAllPages();
        loader.style.display = 'none';
    });

    // Показываем кнопку после загрузки PDF
    startFinishBtn.classList.remove('hidden');

    /* Sign font style start */
    const changeStyleBtn = document.getElementById('changeStyle');
    const fontOptions = document.getElementById('fontOptions');
    const styleFullName = document.getElementById('styleFullName');
    let selectedFont = 'Shadows Into Light'; // Default font

    styleFullName.textContent = signerName;

    changeStyleBtn.addEventListener('click', () => {
        fontOptions.style.display = fontOptions.style.display === 'none' ? 'block' : 'none';
        if (fontOptions.style.display === 'block') {
            document.querySelector('.modal-content').append(fontOptions);
        }
    });

    document.querySelectorAll('.font-option').forEach(option => {
        option.textContent = signerName;
        option.addEventListener('click', (e) => {
            document.querySelectorAll('.font-option').forEach(opt => opt.style.border = '1px solid #ccc');
            e.target.style.border = '2px solid #007bff';
            selectedFont = e.target.getAttribute('data-font');
            styleFullName.style.fontFamily = selectedFont;
            fontOptions.style.display = 'none'; // Hide font options after selection
        });
    });

    signatureModal.on('click', (e) => {
        if (!fontOptions.contains(e.target) && !changeStyleBtn.contains(e.target)) {
            fontOptions.style.display = 'none';
        }
    });

    function openSignatureModal(coord, canvas, viewport) {
        signatureModal.modal('show');
        document.getElementById('saveSignature').onclick = () => {
            let signatureDataUrl;
            if ($('#select-style-tab').hasClass('active')) {
                signatureDataUrl = createSignatureImage(fullNameInput.value, styleFullName.style.fontFamily);
            } else if (!signaturePadModal.isEmpty()) {
                signatureDataUrl = signaturePadModal.toDataURL('image/png');
            }
            if (signatureDataUrl) {
                createSignatureImageWithDetails(signatureDataUrl, envId).then((val) => {
                    signatureModal.modal('hide');
                    signatures.push({ signature: val });
                    placeSignature(coord, val, canvas, viewport);
                });
            }
        };
    }

    function createSignatureImageWithDetails(signatureDataUrl, envelopeId) {
        return new Promise((resolve, reject) => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            canvas.width = 300; // Увеличенная ширина для рамки и текста
            canvas.height = 100; // Уменьшенная высота

            // Нарисуем синюю рамку с закругленными углами сверху и снизу слева
            ctx.strokeStyle = '#002080'; // Более темный синий цвет для линии
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(10, 25); // Начинаем сверху с отступом
            ctx.arcTo(10, 10, 25, 10, 20); // Закругленный угол сверху
            ctx.lineTo(40, 10); // Горизонтальная линия сверху длиной 45px (уменьшена на 10%)
            ctx.moveTo(10, 25); // Перемещаемся обратно к началу
            ctx.lineTo(10, 75); // Вертикальная линия
            ctx.arcTo(10, 90, 25, 90, 20); // Закругленный угол снизу
            ctx.lineTo(40, 90); // Горизонтальная линия снизу длиной 45px (уменьшена на 10%)
            ctx.stroke();

            // Нарисуем текст "Signed by:"
            ctx.font = 'bold 13px Arial';
            ctx.fillText('Signed by:', 50, 17); // Рядом с верхней линией

            // Нарисуем номер конверта (envId)
            ctx.font = '13px Arial';
            ctx.fillText(envelopeId.substring(0, 10) + '...', 50, 95); // Рядом с нижней линией

            // Нарисуем подпись
            const img = new Image();
            img.src = signatureDataUrl;
            img.onload = () => {
                ctx.drawImage(img, 15, canvas.height / 3, 200, 50); // Позиция и размер подписи с учетом отступа сверху
                resolve(canvas.toDataURL('image/png')); // Вернем URL изображения после рисования подписи
            };
            img.onerror = (err) => {
                reject(err);
            };
        });
    }

    function createSignatureImage(text, font) {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        ctx.font = `32px ${font}`;
        // Измеряем ширину текста
        const textWidth = ctx.measureText(text).width;
        // Устанавливаем ширину и высоту холста на основе ширины текста
        canvas.width = textWidth + 10; // Добавляем немного отступов по краям
        canvas.height = 50;
        ctx.font = `32px ${font}`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillText(text, 10, canvas.height / 2); // Добавляем отступ слева
        return canvas.toDataURL('image/png');
    }

    /* Sign font style end */


    function placeSignature(coord, signatureDataUrl, canvas, viewport) {
        const ctx = canvas.getContext('2d');
        const img = new Image();
        img.src = signatureDataUrl;
        img.onload = () => {
            const x = coord.x / viewport.width * canvas.width;
            const y = coord.y / viewport.height * canvas.height;
            ctx.drawImage(img, x, y, (300 * .6) / viewport.width * canvas.width, (100 * .6) / viewport.height * canvas.height); // Размер подписи можно регулировать
        };
        coord.signed = true;
        coord.signature = signatureDataUrl;

        // Обновляем кнопки и перемещаемся к следующей неподписанной кнопке
        updateSignButtons();
        setTimeout(scrollToNextUnsigned, 500); // Добавляем небольшую задержку перед прокруткой
    }


    function renderAllPages() {
        for (let num = 1; num <= pdfDoc.numPages; num++) {
            pdfDoc.getPage(num).then(page => {
                const viewport = page.getViewport({ scale: 1.5 });
                const canvas = document.createElement('canvas');
                const div = document.createElement('div');
                div.classList.add('pdf-page');
                canvas.height = viewport.height;
                canvas.width = viewport.width;
                div.appendChild(canvas);
                pdfViewer.appendChild(div);

                const renderContext = {
                    canvasContext: canvas.getContext('2d'),
                    viewport: viewport
                };

                canvas.style.width = '100%';
                canvas.style.height = 'auto';

                page.render(renderContext).promise.then(() => {
                    drawSignButtons(num, viewport, canvas, div);
                });
            });
        }
    }

    function drawSignButtons(pageNum, viewport, canvas, div) {
        signCoordinates
            .filter(coord => coord.page === pageNum && !coord.signed)
            .forEach(coord => {
                const signButton = document.createElement('button');
                signButton.classList.add('btn', 'sign-button', 'position-absolute');
                signButton.style.top = `${coord.y / viewport.height * 100}%`;
                signButton.style.left = `${coord.x / viewport.width * 100}%`;
                signButton.style.width = `${100 / viewport.width * canvas.clientWidth}px`;
                signButton.style.height = `${75 / viewport.height * canvas.clientHeight}px`;
                signButton.style.fontSize = `${0.02 * canvas.clientWidth}px`;
                signButton.innerHTML = 'Sign <div class="icon" style="font-size: inherit">&#8595;</div>';
                signButton.setAttribute('data-toggle', 'tooltip');
                signButton.setAttribute('data-placement', 'top');
                signButton.setAttribute('title', 'Required - Sign here');
                $(signButton).tooltip();
                signButton.addEventListener('click', () => {
                    if (signatures.length > 0) {
                        placeSignature(coord, signatures[0].signature, canvas, viewport);
                    } else {
                        openSignatureModal(coord, canvas, viewport);
                    }
                });
                div.appendChild(signButton);
            });
        updateStartFinishButton();
    }

    function updateSignButtons() {
        document.querySelectorAll('.pdf-page button').forEach(button => button.remove());
        for (let num = 1; num <= pdfDoc.numPages; num++) {
            const div = document.querySelector(`.pdf-page:nth-child(${num})`);
            const canvas = div.querySelector('canvas');
            pdfDoc.getPage(num).then(page => {
                const viewport = page.getViewport({ scale: 1.5 });
                drawSignButtons(num, viewport, canvas, div);
            });
        }
    }

    function scrollToNextUnsigned() {
        const unsignedButtons = Array.from(document.querySelectorAll('.pdf-page button:not([disabled])'));
        if (unsignedButtons.length > 0) {
            const firstUnsignedButton = unsignedButtons[0];
            firstUnsignedButton.scrollIntoView({ behavior: 'smooth', block: 'center' });
            setTimeout(() => {
                $(firstUnsignedButton).tooltip('show');
                setTimeout(() => {
                    $(firstUnsignedButton).tooltip('hide');
                }, 2000); // Hide tooltip after 2 seconds
            }, 600); // Delay to ensure scroll completes
        }
    }

    function updateStartFinishButton() {
        const unsignedButtons = Array.from(document.querySelectorAll('.pdf-page button:not([disabled])'));
        const finishButtonContainer = document.getElementById('finishButtonContainer');

        if (unsignedButtons.length > 0) {
            startFinishBtn.classList.remove('btn-finish');
            startFinishBtn.classList.add('btn-start');
            startFinishBtn.textContent = signatures.length > 0 ? 'Next' : 'Start';
            finishButtonContainer.style.display = 'none'; // скрыть большую кнопку Finish
        } else {
            startFinishBtn.classList.remove('btn-start');
            startFinishBtn.classList.add('btn-finish');
            startFinishBtn.textContent = 'Finish';
            finishButtonContainer.style.display = 'block'; // показать большую кнопку Finish
        }
    }

    async function sendSignatures() {
        const signatureDataUrl = signatures[0].signature; // Используем первую подпись, так как они одинаковы

        // Показываем лоадер и оверлей
        overlay.style.display = 'block';
        loader.style.display = 'block';

        // Делаем кнопку неактивной
        startFinishBtn.disabled = true;

        try {
            const ipAddress = await getLocalIPAddress();
            const deviceInfo = getDeviceInfo();

            const response = await fetch(`${_baseUrl}/signingTest2`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    code: code,
                    signature: signatureDataUrl,
                    ip: ipAddress,
                    deviceInfo: deviceInfo,
                    location: _location,
                }),
            });

            const result = await response.json();
            if (result.data && result.data.pdf) {
                showSignedDocument(result.data.pdf);
                // Удаляем кнопку "Finish" и "Big Finish"
                startFinishBtn.remove();
                document.getElementById('finishButtonContainer').remove();
            } else {
                const errorMessage = result.error && result.error.message ? result.error.message : 'Error signing document';
                alert(errorMessage);
            }
        } catch (error) {
            console.error('Error sending signatures:', error);
            alert('Error sending signatures');
        } finally {
            // Скрываем лоадер и оверлей
            overlay.style.display = 'none';
            loader.style.display = 'none';
            // Возвращаем кнопку в активное состояние, если произошла ошибка
            startFinishBtn.disabled = false;
        }
    }

    function showSignedDocument(signedPdfBase64) {
        const pdfViewer = document.getElementById('pdfViewer');
        pdfViewer.innerHTML = '<div class="success-message"><h2>The document was successfully signed</h2><button id="downloadSignedPdf" class="btn btn-primary">Download</button></div>';
        const downloadButton = document.getElementById('downloadSignedPdf');
        downloadButton.addEventListener('click', () => {
            const link = document.createElement('a');
            link.href = `data:application/pdf;base64,${signedPdfBase64}`;
            link.download = 'signed_document.pdf';
            link.click();
        });
    }

    startFinishBtn.addEventListener('click', () => {
        if (startFinishBtn.classList.contains('btn-start')) {
            if (startFinishBtn.textContent === 'Start') {
                startFinishBtn.textContent = 'Next';
            }
            scrollToNextUnsigned();
        } else if (startFinishBtn.classList.contains('btn-next')) {
            scrollToNextUnsigned();
        } else {
            if (signCoordinates.every(coord => coord.signed)) {
                sendSignatures();
            } else {
                scrollToNextUnsigned();
            }
        }
    });

    document.getElementById('bigFinishBtn').addEventListener('click', () => {
        if (signCoordinates.every(coord => coord.signed)) {
            sendSignatures();
        } else {
            scrollToNextUnsigned();
        }
    });

    document.getElementById('clear').addEventListener('click', () => {
        signaturePadModal.clear();
    });

    window.addEventListener('resize', updateSignButtons);
}

function getDeviceInfo() {
    const parser = bowser.getParser(window.navigator.userAgent);
    const info = parser.getResult();
    return {
        browser: info.browser.name,
        browserVersion: info.browser.version,
        os: info.os.name,
        osVersion: info.os.version,
        platform: info.platform.type,
        userAgent: navigator.userAgent
    };
}

async function getLocalIPAddress() {
    return new Promise((resolve, reject) => {
        const peerConnection = new RTCPeerConnection({ iceServers: [] });
        peerConnection.createDataChannel('');
        peerConnection.createOffer()
            .then(offer => peerConnection.setLocalDescription(offer))
            .catch(err => reject(err));
        peerConnection.onicecandidate = event => {
            if (event && event.candidate && event.candidate.candidate) {
                const parts = event.candidate.candidate.split(' ');
                const address = parts[4];
                peerConnection.onicecandidate = null;
                resolve(address);
            }
        };
    });
}

// Function to get coordinates
async function getCoordinates() {
    return new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                resolve({
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude,
                    accuracy: position.coords.accuracy
                });
            },
            (error) => {
                resolve(null); // Return null if location access is denied or any error occurs
            }
        );
    });
}