import { API_KEY } from '../constants';

export async function processImage(toolApiEndpoint: string, imageFile: File): Promise<string> {
  try {
    // Use the proxy server URLs instead of direct API calls
    const PROXY_BASE_URL = 'http://localhost:3001';
    
    console.log('Starting image processing...');

    // Step 1: Get upload URL from LightXEditor via proxy
    const uploadUrlResponse = await fetch(`${PROXY_BASE_URL}/api/lightx/v2/uploadImageUrl`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        uploadType: 'imageUrl',
        size: imageFile.size,
        contentType: imageFile.type,
      }),
    });

    if (!uploadUrlResponse.ok) {
      const errorText = await uploadUrlResponse.text();
      throw new Error(`Failed to get upload URL: ${uploadUrlResponse.status} - ${errorText}`);
    }

    const uploadData = await uploadUrlResponse.json();
    
    // Check if the response has the expected structure
    if (!uploadData.body || !uploadData.body.uploadImage || !uploadData.body.imageUrl) {
      throw new Error(`Invalid upload URL response: ${JSON.stringify(uploadData)}`);
    }

    const { uploadImage, imageUrl } = uploadData.body;

    // Step 2: Upload image directly to S3 using the pre-signed URL
    // Pre-signed URLs are designed to be used directly by clients
    const uploadImageResponse = await fetch(uploadImage, {
      method: 'PUT',
      headers: {
        'Content-Type': imageFile.type,
        'Content-Length': imageFile.size.toString(),
      },
      body: imageFile,
    });

    if (!uploadImageResponse.ok) {
      const errorText = await uploadImageResponse.text();
      throw new Error(`Failed to upload image: ${uploadImageResponse.status} - ${errorText}`);
    }

    // Step 3: Call remove-background API via the generic proxy endpoint
    const removeBackgroundResponse = await fetch(`${PROXY_BASE_URL}/api/lightx-proxy`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        endpoint: 'v1/remove-background',
        body: {
          imageUrl: imageUrl,
          // Optional: you can add background parameter here
          // background: 'transparent' // or color code like '#ffffff'
        }
      }),
    });

    if (!removeBackgroundResponse.ok) {
      const errorText = await removeBackgroundResponse.text();
      throw new Error(`Failed to remove background: ${removeBackgroundResponse.status} - ${errorText}`);
    }

    const backgroundRemovalData = await removeBackgroundResponse.json();
    
    if (!backgroundRemovalData.body || !backgroundRemovalData.body.orderId) {
      throw new Error(`Invalid remove background response: ${JSON.stringify(backgroundRemovalData)}`);
    }

    const { orderId } = backgroundRemovalData.body;

    // Step 4: Poll for order status using V1 endpoint
    let resultUrl = '';
    let retries = 0;
    const maxRetries = 5; // As per documentation
    const pollInterval = 3000; // 3 seconds as per documentation

    while (!resultUrl && retries < maxRetries) {
      // Wait before polling (except for first attempt)
      if (retries > 0) {
        await new Promise((resolve) => setTimeout(resolve, pollInterval));
      }

      const orderStatusResponse = await fetch(`${PROXY_BASE_URL}/api/lightx/v2/order-status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          orderId: orderId,
        }),
      });

      if (!orderStatusResponse.ok) {
        const errorText = await orderStatusResponse.text();
        throw new Error(`Failed to get order status: ${orderStatusResponse.status} - ${errorText}`);
      }

      const orderStatus = await orderStatusResponse.json();
      
      if (!orderStatus.body) {
        throw new Error(`Invalid order status response: ${JSON.stringify(orderStatus)}`);
      }

      if (orderStatus.body.status === 'active' && orderStatus.body.output) {
        resultUrl = orderStatus.body.output;
        break;
      } else if (orderStatus.body.status === 'failed') {
        throw new Error(`Image processing failed: ${orderStatus.body.message || 'Unknown error'}`);
      }
      // If status is 'init', continue polling
      
      retries++;
    }

    if (!resultUrl) {
      throw new Error('Processing timeout: No result URL found after maximum retries.');
    }

    return resultUrl;
  } catch (error) {
    console.error('Error processing image:', error);
    throw error;
  }
}
