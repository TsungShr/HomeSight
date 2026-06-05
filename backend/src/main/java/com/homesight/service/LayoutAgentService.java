package com.homesight.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.homesight.config.DoubaoProperties;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import org.springframework.http.*;
import org.springframework.web.client.RestClientException;

import java.util.*;

/**
 * 通过装修知识智能体（Python Agent）获取文字建议，
 * 再通过豆包图生图 API 生成水电布局图。
 *
 * 流程：Agent(文字建议) → 豆包图生图(布局图) → OSS(存储) → 返回
 */
@Slf4j
@Service
public class LayoutAgentService {

    private static final String AGENT_BASE = "http://localhost:8081";
    private static final String DOUBAO_IMAGE_URL = "https://ark.cn-beijing.volces.com/api/v1/images/generations";

    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;
    private final DoubaoProperties doubaoProps;
    private final OssService ossService;

    public LayoutAgentService(ObjectMapper objectMapper,
                              DoubaoProperties doubaoProps,
                              OssService ossService) {
        this.objectMapper = objectMapper;
        this.doubaoProps = doubaoProps;
        this.ossService = ossService;
        this.restTemplate = new RestTemplate();
    }

    /**
     * 生成水电布局：文字建议 + 布局图
     *
     * @param floorPlanImageUrl 户型图 OSS URL
     * @param roomDataJson      房间结构 JSON（传给 Agent 用于生成更精准的建议）
     * @param roomInfo          额外房间信息（如"两室一厅，80平米"）
     * @param outletLevel       插座等级：充足/标准/基础
     * @param networkLevel      网络等级：全屋WiFi/局部覆盖/基础
     * @param hasSmartHome      是否需要智能家居
     * @return 包含文字建议 + 布局图 URL
     */
    public LayoutResult generateLayoutWithImage(
            String floorPlanImageUrl,
            String roomDataJson,
            String roomInfo,
            String outletLevel,
            String networkLevel,
            boolean hasSmartHome) {

        // Step 1: 调用 Agent 获取文字建议
        String textAdvice = fetchAgentAdvice(roomDataJson, roomInfo, outletLevel, networkLevel, hasSmartHome);

        // Step 2: 构建图生图 prompt
        String imagePrompt = buildImagePrompt(roomDataJson, textAdvice);

        // Step 3: 调用豆包图生图 API
        String generatedImageUrl = generateLayoutImage(floorPlanImageUrl, imagePrompt);

        // Step 4: 如果生成了图，上传到 OSS 持久化（豆包返回的 URL 有时效性）
        if (generatedImageUrl != null && generatedImageUrl.startsWith("https://ark-")) {
            try {
                String persistedUrl = uploadToOss(generatedImageUrl);
                generatedImageUrl = persistedUrl;
            } catch (Exception e) {
                log.warn("布局图上传OSS失败，保留临时URL: {}", e.getMessage());
            }
        }

        return new LayoutResult(textAdvice, generatedImageUrl);
    }

    // ─── Step 1: Agent 文字建议 ───────────────────────────────────────────

    private String fetchAgentAdvice(String roomDataJson, String roomInfo,
                                     String outletLevel, String networkLevel,
                                     boolean hasSmartHome) {
        try {
            Map<String, Object> body = new HashMap<>();
            body.put("query", buildLayoutQuery(roomDataJson, roomInfo, outletLevel, networkLevel, hasSmartHome));
            if (roomInfo != null && !roomInfo.isEmpty()) {
                body.put("room_info", roomInfo);
            }

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            HttpEntity<Map<String, Object>> entity = new HttpEntity<>(body, headers);

            String url = AGENT_BASE + "/chat";
            Map<String, Object> resp = restTemplate.postForObject(url, entity, Map.class);

            if (resp != null && resp.get("answer") != null) {
                String answer = (String) resp.get("answer");
                log.info("Agent 文字建议获取成功，长度: {}", answer.length());
                return answer;
            }
        } catch (RestClientException e) {
            log.warn("Agent 服务不可用，跳过文字建议: {}", e.getMessage());
        }
        return "";
    }

    private String buildLayoutQuery(String roomDataJson, String roomInfo,
                                    String outletLevel, String networkLevel,
                                    boolean hasSmartHome) {
        StringBuilder q = new StringBuilder();
        q.append("请为以下户型提供水电布局建议：");
        if (roomInfo != null && !roomInfo.isEmpty()) {
            q.append("户型信息：").append(roomInfo).append("。");
        }
        if (roomDataJson != null && !roomDataJson.isEmpty()) {
            try {
                JsonNode node = objectMapper.readTree(roomDataJson);
                JsonNode rooms = node.get("rooms");
                if (rooms != null && rooms.isArray()) {
                    q.append("房间包括：");
                    for (JsonNode r : rooms) {
                        String name = r.has("name") ? r.get("name").asText() : "";
                        String type = r.has("type") ? r.get("type").asText() : "";
                        int area = r.has("area") ? r.get("area").asInt() : 0;
                        if (!name.isEmpty()) q.append(name).append("(").append(area).append("平米)").append("、");
                    }
                    String s = q.toString();
                    if (s.endsWith("、")) q = new StringBuilder(s.substring(0, s.length() - 1));
                }
            } catch (Exception e) {
                log.debug("解析 roomDataJson 失败: {}", e.getMessage());
            }
        }
        q.append("。插座等级：").append(outletLevel)
                .append("，网络等级：").append(networkLevel)
                .append("，智能家居：").append(hasSmartHome ? "需要" : "不需要");
        q.append("。请给出每个房间的水电布局要点和建议。");
        return q.toString();
    }

    // ─── Step 2: 构建图生图 Prompt ──────────────────────────────────────────

    private String buildImagePrompt(String roomDataJson, String textAdvice) {
        StringBuilder prompt = new StringBuilder();
        prompt.append("这是一张装修户型图。请在图上用专业的水电布局示意图进行标注：\n");
        prompt.append("- 插座：用红色圆点标注在合适位置\n");
        prompt.append("- 网口/网络：用蓝色方块标注\n");
        prompt.append("- 开关：用绿色圆点标注\n");
        prompt.append("- 水管线路：用青色虚线绘制\n");
        prompt.append("- 电路线：用粉色虚线绘制\n");
        prompt.append("- 在图上或图下用简洁的文字标签标注每个点位类型\n");

        if (textAdvice != null && !textAdvice.isEmpty()) {
            String summary = textAdvice.length() > 200
                    ? textAdvice.substring(0, 200) + "..."
                    : textAdvice;
            prompt.append("参考水电建议：").append(summary).append("\n");
        }

        prompt.append("请保持原始户型图的整体布局和结构不变，只添加水电标注。");
        return prompt.toString();
    }

    // ─── Step 3: 豆包图生图 ───────────────────────────────────────────────

    private String generateLayoutImage(String floorPlanImageUrl, String imagePrompt) {
        try {
            Map<String, Object> payload = new HashMap<>();
            // 使用 Seedream 模型，支持图生图
            payload.put("model", "doubao-seedream-4-0-250828");
            payload.put("prompt", imagePrompt);
            payload.put("image", floorPlanImageUrl);
            payload.put("size", "2K");
            payload.put("n", 1);
            payload.put("response_format", "url");
            payload.put("watermark", false);

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.set("Authorization", "Bearer " + doubaoProps.getApiKey());

            HttpEntity<Map<String, Object>> entity = new HttpEntity<>(payload, headers);

            String response = restTemplate.exchange(
                    DOUBAO_IMAGE_URL,
                    HttpMethod.POST,
                    entity,
                    String.class
            ).getBody();

            log.debug("豆包图生图响应: {}", response);

            // 解析返回的 URL
            JsonNode root = objectMapper.readTree(response);
            JsonNode data = root.path("data");
            if (data.isArray() && data.size() > 0) {
                JsonNode first = data.get(0);
                String url = first.path("url").asText(null);
                if (url != null && !url.isEmpty()) {
                    log.info("豆包图生图成功: {}", url);
                    return url;
                }
            }

            // 备用：从 root 直接找 url
            String url = root.path("url").asText(null);
            if (url != null && !url.isEmpty()) {
                return url;
            }

            log.warn("豆包图生图返回格式异常，未找到图片URL: {}", response);
            return null;

        } catch (RestClientException e) {
            log.error("豆包图生图 API 调用失败: {}", e.getMessage());
            return null;
        } catch (Exception e) {
            log.error("解析豆包图生图响应失败: {}", e.getMessage());
            return null;
        }
    }

    // ─── Step 4: 持久化到 OSS ───────────────────────────────────────────────

    private String uploadToOss(String imageUrl) throws Exception {
        java.io.InputStream in = new java.net.URL(imageUrl).openStream();
        byte[] imageBytes = in.readAllBytes();
        in.close();

        String key = "layout/" + UUID.randomUUID() + ".png";
        String url = ossService.uploadBytesWithKey(imageBytes, key, "image/png");
        log.info("布局图已上传OSS: {}", url);
        return url;
    }

    // ─── 结果封装 ────────────────────────────────────────────────────────

    public static class LayoutResult {
        public String textAdvice;       // Agent 生成的文字建议
        public String imageUrl;         // 豆包生成的布局图 URL（OSS 持久化）

        public LayoutResult(String textAdvice, String imageUrl) {
            this.textAdvice = textAdvice;
            this.imageUrl = imageUrl;
        }
    }
}
