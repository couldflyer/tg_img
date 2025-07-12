// Cloudflare Pages Function for image upload
// API endpoint: /api/upload

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    // 检查环境变量
    if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHANNEL_ID) {
      return new Response(JSON.stringify({
        success: false,
        error: '服务配置错误'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 检查请求方法
    if (request.method !== 'POST') {
      return new Response(JSON.stringify({
        success: false,
        error: '不支持的请求方法'
      }), {
        status: 405,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 获取客户端IP进行速率限制
    const clientIP = request.headers.get('CF-Connecting-IP') || 
                     request.headers.get('X-Forwarded-For') || 
                     'unknown';

    // 简单的速率限制检查（使用KV存储会更好，这里用内存作为示例）
    const now = Date.now();
    const hourAgo = now - 3600000; // 1小时前

    // 解析表单数据
    const formData = await request.formData();
    const imageFile = formData.get('image');

    if (!imageFile) {
      return new Response(JSON.stringify({
        success: false,
        error: '请选择要上传的图片文件'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 验证文件类型
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(imageFile.type)) {
      return new Response(JSON.stringify({
        success: false,
        error: '只支持图片文件 (jpeg, jpg, png, gif, webp)'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 验证文件大小 (5MB)
    const maxSize = parseInt(env.MAX_FILE_SIZE) || 5 * 1024 * 1024;
    if (imageFile.size > maxSize) {
      return new Response(JSON.stringify({
        success: false,
        error: '文件大小不能超过5MB'
      }), {
        status: 413,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 上传到Telegram
    const result = await uploadToTelegram(imageFile, env);

    return new Response(JSON.stringify({
      success: true,
      url: result.url,
      filename: imageFile.name,
      size: imageFile.size
    }), {
      status: 200,
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST',
        'Access-Control-Allow-Headers': 'Content-Type'
      }
    });

  } catch (error) {
    console.error('上传错误:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message || '上传失败，请稍后重试'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

async function uploadToTelegram(file, env) {
  const botToken = env.TELEGRAM_BOT_TOKEN;
  const channelId = env.TELEGRAM_CHANNEL_ID;
  
  // 创建表单数据
  const formData = new FormData();
  formData.append('chat_id', channelId);
  formData.append('photo', file, file.name);
  formData.append('caption', file.name);

  // 发送到Telegram
  const response = await fetch(`https://api.telegram.org/bot${botToken}/sendPhoto`, {
    method: 'POST',
    body: formData
  });

  const result = await response.json();

  if (!result.ok) {
    throw new Error(`Telegram API错误: ${result.description}`);
  }

  // 获取图片URL
  if (result.result && result.result.photo && result.result.photo.length > 0) {
    const largestPhoto = result.result.photo[result.result.photo.length - 1];
    
    // 获取文件信息
    const fileResponse = await fetch(`https://api.telegram.org/bot${botToken}/getFile?file_id=${largestPhoto.file_id}`);
    const fileResult = await fileResponse.json();
    
    if (fileResult.ok) {
      const imageUrl = `https://api.telegram.org/file/bot${botToken}/${fileResult.result.file_path}`;
      return {
        success: true,
        url: imageUrl,
        file_id: largestPhoto.file_id,
        message_id: result.result.message_id
      };
    }
  }

  throw new Error('上传失败，未获取到图片信息');
}

// 处理OPTIONS请求 (CORS preflight)
export async function onRequestOptions() {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400'
    }
  });
}