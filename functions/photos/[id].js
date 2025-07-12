// Cloudflare Pages Function for image proxy
// API endpoint: /photos/:id

export async function onRequestGet(context) {
  const { request, env, params } = context;

  try {
    const imageId = params.id;
    
    if (!imageId) {
      return new Response('Image ID required', { status: 400 });
    }

    // 从KV存储或URL中获取原始Telegram图片URL
    const originalUrl = await getOriginalImageUrl(imageId, env);
    
    if (!originalUrl) {
      return new Response('Image not found', { status: 404 });
    }

    // 代理图片请求
    const imageResponse = await fetch(originalUrl);
    
    if (!imageResponse.ok) {
      return new Response('Failed to fetch image', { status: 502 });
    }

    // 获取图片数据和MIME类型
    const imageData = await imageResponse.arrayBuffer();
    const contentType = imageResponse.headers.get('content-type') || 'image/jpeg';

    // 设置缓存头
    const headers = new Headers({
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=31536000', // 1年缓存
      'Access-Control-Allow-Origin': '*',
      'Cross-Origin-Resource-Policy': 'cross-origin'
    });

    return new Response(imageData, { headers });

  } catch (error) {
    console.error('Proxy error:', error);
    return new Response('Internal server error', { status: 500 });
  }
}

async function getOriginalImageUrl(imageId, env) {
  try {
    // 提取基础ID（移除扩展名）
    const baseId = imageId.replace(/\.(jpg|jpeg|png|gif|webp)$/i, '');
    
    // 尝试从KV存储获取
    if (env.IMAGE_STORE) {
      const data = await env.IMAGE_STORE.get(baseId);
      if (data) {
        return JSON.parse(data).url;
      }
    }
    
    // 如果KV不可用，尝试从imageId解析（假设格式为 file_<fileId>）
    if (baseId.startsWith('file_')) {
      const fileId = baseId.replace('file_', '').replace(/_/g, '/');
      const botToken = env.TELEGRAM_BOT_TOKEN;
      
      if (botToken) {
        try {
          // 通过Telegram API获取文件信息
          const fileResponse = await fetch(`https://api.telegram.org/bot${botToken}/getFile?file_id=${fileId}`);
          const fileResult = await fileResponse.json();
          
          if (fileResult.ok) {
            return `https://api.telegram.org/file/bot${botToken}/${fileResult.result.file_path}`;
          }
        } catch (error) {
          console.error('Telegram API error:', error);
        }
      }
    }
    
    return null;
  } catch (error) {
    console.error('Failed to get original URL:', error);
    return null;
  }
}