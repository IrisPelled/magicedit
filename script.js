let originalImage = null;
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

document.getElementById('upload').addEventListener('change', function(e) {
    const reader = new FileReader();
    
    reader.onload = function(event) {
        const img = new Image();
        img.onload = function() {
            const maxWidth = 600;
            const maxHeight = 400;
            let width = img.width;
            let height = img.height;

            if (width > height) {
                if (width > maxWidth) {
                    height *= maxWidth / width;
                    width = maxWidth;
                }
            } else {
                if (height > maxHeight) {
                    width *= maxHeight / height;
                    height = maxHeight;
                }
            }

            canvas.width = width;
            canvas.height = height;
            ctx.drawImage(img, 0, 0, width, height);
            originalImage = ctx.getImageData(0, 0, canvas.width, canvas.height);
        }
        img.src = event.target.result;
    }
    reader.readAsDataURL(e.target.files[0]);
});

document.getElementById('bw').addEventListener('click', () => applyFilter('bw'));
document.getElementById('vintage').addEventListener('click', () => applyFilter('vintage'));
document.getElementById('sketch').addEventListener('click', () => applyFilter('sketch'));
document.getElementById('origami').addEventListener('click', () => applyFilter('pixelify'));
document.getElementById('download').addEventListener('click', downloadImage);

function applyFilter(filterType) {
    if (!originalImage) return;
    
    const imageData = new ImageData(new Uint8ClampedArray(originalImage.data), originalImage.width, originalImage.height);
    const data = imageData.data;

    switch (filterType) {
        case 'bw':
            for (let i = 0; i < data.length; i += 4) {
                const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
                data[i] = data[i + 1] = data[i + 2] = avg;
            }
            break;
        case 'vintage':
            for (let i = 0; i < data.length; i += 4) {
                // Apply sepia tone
                const r = data[i];
                const g = data[i + 1];
                const b = data[i + 2];
                
                data[i] = Math.min(255, (r * 0.393) + (g * 0.769) + (b * 0.189));
                data[i + 1] = Math.min(255, (r * 0.349) + (g * 0.686) + (b * 0.168));
                data[i + 2] = Math.min(255, (r * 0.272) + (g * 0.534) + (b * 0.131));
                
                // Enhance red and decrease blue for warmer tone
                data[i] = Math.min(255, data[i] * 1.1);
                data[i + 2] = Math.max(0, data[i + 2] * 0.9);
                
                // Add earthy brown tone
                const brightness = (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114) / 255;
                if (brightness > 0.5) {
                    // Lighten and add earthy tone to brighter areas
                    data[i] = Math.min(255, data[i] + 20);
                    data[i + 1] = Math.min(255, data[i + 1] + 10);
                    data[i + 2] = Math.max(0, data[i + 2] - 10);
                } else {
                    // Slightly darken and add earthy tone to darker areas
                    data[i] = Math.max(0, data[i] - 10);
                    data[i + 1] = Math.max(0, data[i + 1] - 5);
                    data[i + 2] = Math.max(0, data[i + 2] - 15);
                }
                
                // Add subtle vignette effect
                const x = (i / 4) % imageData.width;
                const y = Math.floor((i / 4) / imageData.width);
                const distX = Math.abs(x - imageData.width / 2) / (imageData.width / 2);
                const distY = Math.abs(y - imageData.height / 2) / (imageData.height / 2);
                const dist = Math.sqrt(distX * distX + distY * distY);
                const vignetteIntensity = 0.3;
                const vignette = 1 - dist * vignetteIntensity;
                
                data[i] *= vignette;
                data[i + 1] *= vignette;
                data[i + 2] *= vignette;
            }
            break;
        case 'sketch':
            const grayscale = new Uint8ClampedArray(data.length);
            for (let i = 0; i < data.length; i += 4) {
                const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
                grayscale[i] = grayscale[i + 1] = grayscale[i + 2] = avg;
                grayscale[i + 3] = 255;
            }
            
            const edgeData = detectEdges(grayscale, canvas.width, canvas.height);
            
            for (let i = 0; i < data.length; i += 4) {
                const edge = 255 - edgeData[i];
                data[i] = data[i + 1] = data[i + 2] = edge;
            }
            break;
        case 'pixelify':
            const blockSize = 5; // Smaller squares
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            for (let y = 0; y < canvas.height; y += blockSize) {
                for (let x = 0; x < canvas.width; x += blockSize) {
                    const index = (y * canvas.width + x) * 4;
                    const r = data[index];
                    const g = data[index + 1];
                    const b = data[index + 2];

                    ctx.fillStyle = `rgb(${r},${g},${b})`;
                    ctx.fillRect(x, y, blockSize, blockSize);
                }
            }
            return; // Skip putImageData for pixelify
    }

    ctx.putImageData(imageData, 0, 0);
}

function detectEdges(data, width, height) {
    const sobelX = [-1, 0, 1, -2, 0, 2, -1, 0, 1];
    const sobelY = [-1, -2, -1, 0, 0, 0, 1, 2, 1];
    const edgeData = new Uint8ClampedArray(data.length);

    for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
            let pixelX = 0, pixelY = 0;

            for (let kernelY = -1; kernelY <= 1; kernelY++) {
                for (let kernelX = -1; kernelX <= 1; kernelX++) {
                    const idx = ((y + kernelY) * width + (x + kernelX)) * 4;
                    const kernelIdx = (kernelY + 1) * 3 + (kernelX + 1);
                    
                    pixelX += data[idx] * sobelX[kernelIdx];
                    pixelY += data[idx] * sobelY[kernelIdx];
                }
            }

            const magnitude = Math.sqrt(pixelX * pixelX + pixelY * pixelY);
            const idx = (y * width + x) * 4;
            edgeData[idx] = edgeData[idx + 1] = edgeData[idx + 2] = magnitude;
            edgeData[idx + 3] = 255;
        }
    }

    return edgeData;
}

function downloadImage() {
    const link = document.createElement('a');
    link.download = 'filtered-image.png';
    link.href = canvas.toDataURL();
    link.click();
}
