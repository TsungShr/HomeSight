package com.homesight.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import com.homesight.config.DoubaoProperties;
import com.homesight.dto.AnalyzeResponse;
import com.homesight.dto.LayoutResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.*;
import java.util.regex.*;

@Slf4j
@Service
public class AiService {

    private static final String BASE_URL = "https://ark.cn-beijing.volces.com/api/v3";

    private final DoubaoProperties doubaoProps;
    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;

    private static final String ANALYZE_PROMPT = """
        你是一个专业的户型图分析专家。请仔细分析这张户型图图片，输出严谨的结构化JSON数据。

        输出格式要求（严格遵循，JSON外不要有任何文字）：
        {
          "totalArea": 估算的总面积数字,
          "rooms": [
            {
              "name": "房间名称",
              "type": "living|bedroom|kitchen|bathroom|balcony|study|storage|other",
              "area": 估算面积数字,
              "walls": [{"x": 相对比例0到1, "y": 相对比例0到1}],
              "doors": [{"x": 相对比例0到1, "y": 相对比例0到1}],
              "windows": [{"x": 相对比例0到1, "y": 相对比例0到1}],
              "features": ["特征描述1", "特征描述2"]
            }
          ],
          "pros": ["优势1", "优势2", "优势3"],
          "cautions": ["注意事项1", "注意事项2"],
          "floorplanData": {
            "walls": [{"start": {"x": 0.1, "y": 0.2}, "end": {"x": 0.5, "y": 0.2}}],
            "doors": [{"position": {"x": 0.3, "y": 0.5}, "width": 0.05, "height": 0.02}],
            "windows": [{"position": {"x": 0.1, "y": 0.2}, "width": 0.08, "height": 0.02}],
            "dimensions": {"width": 1000, "height": 800}
          }
        }
        """;

    private static final String LAYOUT_PROMPT_TPL = """
        根据以下户型结构数据，为每个房间生成智能家居水电布局建议。

        户型数据：
        %s

        用户需求：插座数量%s，网络覆盖%s，智能家居%s

        输出严格JSON格式（JSON外不要有任何文字）：
        {
          "powerOutlets": [
            {"x": 相对比例0到1, "y": 相对比例0到1, "type": "普通插座|大功率插座|USB插座", "roomId": "房间name"}
          ],
          "networkPorts": [
            {"x": 相对比例0到1, "y": 相对比例0到1, "type": "RJ45网口|WiFi AP", "roomId": "房间name"}
          ],
          "switches": [
            {"x": 相对比例0到1, "y": 相对比例0到1, "type": "单开开关|双开开关|智能开关", "roomId": "房间name"}
          ],
          "waterLines": [
            {"points": [{"x": 0.2, "y": 0.3}, {"x": 0.5, "y": 0.6}], "roomId": "厨房"}
          ],
          "electricalRoutes": [
            {"points": [{"x": 0.1, "y": 0.1}, {"x": 0.3, "y": 0.3}], "roomId": "客厅"}
          ],
          "tips": ["建议1", "建议2", "建议3"]
        }
        """;

    public AiService(DoubaoProperties doubaoProps, ObjectMapper objectMapper) {
        this.doubaoProps = doubaoProps;
        this.objectMapper = objectMapper;
        this.restTemplate = new RestTemplate();
    }

    public AnalyzeResponse analyzeFloorplanBase64(byte[] imageBytes, String mimeType) throws Exception {
        String base64Image = Base64.getEncoder().encodeToString(imageBytes);
        Map<String, Object> payload = buildPayloadBase64(ANALYZE_PROMPT, base64Image, mimeType);
        String response = callDoubao(payload);
        return parseAnalyzeResponse(response);
    }

    public LayoutResponse generateLayout(String roomDataJson, String outletLevel,
                                         String networkLevel, boolean hasSmartHome) throws Exception {
        String prompt = String.format(LAYOUT_PROMPT_TPL,
                roomDataJson, outletLevel, networkLevel,
                hasSmartHome ? "需要" : "不需要");
        Map<String, Object> payload = buildPayloadText(prompt);
        String response = callDoubao(payload);
        return parseLayoutResponse(response);
    }

    private Map<String, Object> buildPayloadBase64(String prompt, String base64Image, String mimeType) {
        Map<String, Object> payload = new HashMap<>();
        payload.put("model", doubaoProps.getModel());
        payload.put("input", List.of(
                Map.of("role", "user", "content", List.of(
                        Map.of("type", "input_image", "image_url", "data:" + mimeType + ";base64," + base64Image),
                        Map.of("type", "input_text", "text", prompt)
                ))
        ));
        return payload;
    }

    private Map<String, Object> buildPayloadText(String prompt) {
        Map<String, Object> payload = new HashMap<>();
        payload.put("model", doubaoProps.getModel());
        payload.put("input", List.of(
                Map.of("role", "user", "content", List.of(
                        Map.of("type", "input_text", "text", prompt)
                ))
        ));
        return payload;
    }

    private String callDoubao(Map<String, Object> payload) throws Exception {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.set("Authorization", "Bearer " + doubaoProps.getApiKey());

        HttpEntity<Map<String, Object>> entity = new HttpEntity<>(payload, headers);
        String body = restTemplate.exchange(
                BASE_URL + "/responses",
                HttpMethod.POST,
                entity,
                String.class
        ).getBody();

        log.debug("Doubao raw response: {}", body);
        JsonObject root = JsonParser.parseString(body).getAsJsonObject();
        return root.getAsJsonArray("output")
                .get(0).getAsJsonObject()
                .get("result").getAsString();
    }

    private AnalyzeResponse parseAnalyzeResponse(String raw) throws Exception {
        String json = extractJson(raw);
        return objectMapper.readValue(json, AnalyzeResponse.class);
    }

    private LayoutResponse parseLayoutResponse(String raw) throws Exception {
        String json = extractJson(raw);
        return objectMapper.readValue(json, LayoutResponse.class);
    }

    private String extractJson(String text) {
        Pattern p = Pattern.compile("\\{[\\s\\S]*\\}");
        Matcher m = p.matcher(text);
        if (m.find()) return m.group();
        return text.trim();
    }
}
