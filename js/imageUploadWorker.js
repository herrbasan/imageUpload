'use strict';

let offscreenCanvas = null;
let ctx = null;
let currentImageBitmap = null;
let currentImageWidth = 0;
let currentImageHeight = 0;
let isWorking = false;

self.addEventListener('message', function(e) {
	const { type, data } = e.data;
	switch (type) {
		case 'init':
			initCanvas(data);
			break;
		case 'updateImage':
			updateImage(data);
			break;
		case 'generateImage':
			generateCroppedImage(data);
			break;
	}
});

function initCanvas({ width, height, backgroundColor }) {
	offscreenCanvas = new OffscreenCanvas(width, height);
	ctx = offscreenCanvas.getContext('2d', { willReadFrequently: true });
	ctx.fillStyle = backgroundColor || '#969696';
	self.postMessage({ type: 'ready' });
}

function updateImage({ imageBitmap }) {
	if (currentImageBitmap) {
		currentImageBitmap.close();
	}
	currentImageBitmap = imageBitmap;
	currentImageWidth = imageBitmap.width;
	currentImageHeight = imageBitmap.height;
	isWorking = false; // Ready for a new job
}

function generateCroppedImage(data) {
	if (isWorking || !currentImageBitmap) {
		return; // Ignore if busy or no image
	}
	isWorking = true;

	const { scale, pos, cropSize, backgroundColor, filter } = data;

	if (offscreenCanvas.width !== cropSize.width || offscreenCanvas.height !== cropSize.height) {
		offscreenCanvas.width = cropSize.width;
		offscreenCanvas.height = cropSize.height;
	}

	ctx.fillStyle = backgroundColor || '#969696';
	ctx.fillRect(0, 0, cropSize.width, cropSize.height);
	ctx.filter = filter || 'none';

	ctx.save();
	ctx.drawImage(currentImageBitmap, pos.x, pos.y, currentImageWidth * scale, currentImageHeight * scale);
	ctx.restore();

	const imageData = ctx.getImageData(0, 0, cropSize.width, cropSize.height);
	offscreenCanvas.convertToBlob({ type: 'image/jpeg', quality: 0.92 }).then(blob => {
		self.postMessage({
			type: 'imageReady',
			blob: blob,
			imageData: imageData
		}, [imageData.data.buffer]);
		isWorking = false;
	}).catch(() => {
		isWorking = false; // Ensure we are not stuck in a working state on error
	});
}
