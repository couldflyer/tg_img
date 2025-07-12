// Cloudflare Pages Function for image upload
// API endpoint: /api/upload

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    // 检查环境变量
    if (!env.TELEGRAM_BOT_TOKEN || (!env.TELEGRAM_GROUP_ID && !env.TELEGRAM_CHANNEL_ID)) {
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

    // 检查速率限制 (50次/小时)
    const rateLimitResult = await checkRateLimit(clientIP, env);
    if (!rateLimitResult.success) {
      return new Response(JSON.stringify({
        success: false,
        error: rateLimitResult.error
      }), {
        status: 429,
        headers: { 'Content-Type': 'application/json' }
      });
    }

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

    // 上传到Telegram前进行NSFW检测
    const nsfwResult = await checkNSFW(imageFile, env);
    if (!nsfwResult.success) {
      return new Response(JSON.stringify({
        success: false,
        error: nsfwResult.error
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 上传到Telegram
    const result = await uploadToTelegram(imageFile, env, request);

    return new Response(JSON.stringify({
      success: true,
      url: result.proxyUrl,
      originalUrl: result.originalUrl,
      filename: imageFile.name,
      size: imageFile.size,
      fileId: result.file_id
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

async function checkRateLimit(clientIP, env) {
  try {
    const now = Date.now();
    const oneHourAgo = now - 3600000; // 1小时前
    const rateLimitKey = `rate_limit_${clientIP}`;
    
    // 如果有KV存储，使用KV进行速率限制
    if (env.IMAGE_STORE) {
      const existingData = await env.IMAGE_STORE.get(rateLimitKey);
      let uploadCounts = existingData ? JSON.parse(existingData) : [];
      
      // 清理1小时前的记录
      uploadCounts = uploadCounts.filter(timestamp => timestamp > oneHourAgo);
      
      // 检查是否超过限制（50次/小时）
      if (uploadCounts.length >= 50) {
        return {
          success: false,
          error: `上传频率过高，请稍后再试。单IP限制：50次/小时`
        };
      }
      
      // 添加当前时间戳
      uploadCounts.push(now);
      
      // 更新KV存储，设置2小时过期时间
      await env.IMAGE_STORE.put(rateLimitKey, JSON.stringify(uploadCounts), {
        expirationTtl: 7200 // 2小时过期
      });
      
      return { success: true };
    }
    
    // 如果没有KV存储，暂时允许上传（生产环境应该有KV存储）
    console.warn('没有配置KV存储，无法进行速率限制');
    return { success: true };
    
  } catch (error) {
    console.error('速率限制检查失败:', error);
    // 错误时允许上传，避免服务中断
    return { success: true };
  }
}

async function checkNSFW(file, env) {
  try {
    // 创建表单数据
    const formData = new FormData();
    formData.append('image', file);

    // 调用NSFW检测API
    const response = await fetch('https://nsfwdet.com/api/v1/detect-nsfw', {
      method: 'POST',
      headers: {
        'X-API-Key': 'nsfw_2f7ab4f1d743d69ee242eec932b19671'
      },
      body: formData
    });

    if (!response.ok) {
      console.warn('NSFW检测API调用失败:', response.status);
      // 如果API调用失败，允许上传（避免服务中断）
      return { success: true };
    }

    const result = await response.json();
    
    if (result.code !== 0) {
      console.warn('NSFW检测返回错误:', result);
      // 如果API返回错误，允许上传
      return { success: true };
    }

    // 检查NSFW分数，如果NSFW分数超过30%则拒绝
    const nsfwScore = result.result.nsfw || 0;
    if (nsfwScore > 0.3) {
      return {
        success: false,
        error: '检测到不适宜内容，上传被拒绝'
      };
    }

    return { success: true };
    
  } catch (error) {
    console.error('NSFW检测错误:', error);
    // 发生错误时允许上传，避免服务中断
    return { success: true };
  }
}

async function uploadToTelegram(file, env, request) {
  const botToken = env.TELEGRAM_BOT_TOKEN;
  // 支持群组ID（私有频道）和频道用户名（公开频道）
  const chatId = env.TELEGRAM_GROUP_ID || env.TELEGRAM_CHANNEL_ID;
  
  // 创建表单数据
  const formData = new FormData();
  formData.append('chat_id', chatId);
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
      const originalUrl = `https://api.telegram.org/file/bot${botToken}/${fileResult.result.file_path}`;
      
      // 生成自定义文件ID和代理URL
      const customFileId = `file_${largestPhoto.file_id.replace(/[\/\-]/g, '_')}`;
      
      // 根据原始文件获取正确的扩展名
      const originalFileName = file.name;
      const fileExtension = originalFileName.substring(originalFileName.lastIndexOf('.') + 1).toLowerCase();
      // 确保扩展名是支持的格式
      const validExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
      const finalExtension = validExtensions.includes(fileExtension) ? fileExtension : 'jpg';
      
      const proxyUrl = `https://${env.CF_PAGES_URL || request.headers.get('host') || 'your-domain.pages.dev'}/photos/${customFileId}.${finalExtension}`;
      
      // 存储映射关系到KV（如果可用）
      try {
        if (env.IMAGE_STORE) {
          await env.IMAGE_STORE.put(customFileId, JSON.stringify({
            url: originalUrl,
            fileId: largestPhoto.file_id,
            fileName: file.name,
            fileExtension: finalExtension,
            uploadTime: new Date().toISOString()
          }), {
            expirationTtl: 3650 * 24 * 60 * 60 // 1年过期
          });
        }
      } catch (kvError) {
        console.warn('KV存储失败:', kvError);
      }
      
      return {
        success: true,
        url: originalUrl,
        proxyUrl: proxyUrl,
        originalUrl: originalUrl,
        file_id: largestPhoto.file_id,
        customFileId: customFileId,
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