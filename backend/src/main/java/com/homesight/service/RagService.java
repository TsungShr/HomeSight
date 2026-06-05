package com.homesight.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonParser;
import com.homesight.config.DoubaoProperties;
import com.homesight.config.RagProperties;
import com.homesight.dto.AnalyzeResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.*;

@Slf4j
@Service
public class RagService {

    private final DoubaoProperties doubaoProps;
    private final RagProperties ragProps;
    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;

    private static final String DOUBAO_BASE_URL = "https://ark.cn-beijing.volces.com/api/v3";

    public RagService(DoubaoProperties doubaoProps, RagProperties ragProps, ObjectMapper objectMapper) {
        this.doubaoProps = doubaoProps;
        this.ragProps = ragProps;
        this.objectMapper = objectMapper;
        this.restTemplate = new RestTemplate();
    }

    /**
     * 根据户型分析结果检索相关装修知识
     */
    public List<Map<String, Object>> retrieveKnowledge(AnalyzeResponse analysis) {
        String query = buildQuery(analysis);
        return vectorSearch(query);
    }

    /**
     * 向量检索：调用 Python RAG 微服务
     */
    @SuppressWarnings("unchecked")
    public List<Map<String, Object>> vectorSearch(String query) {
        String url = ragProps.getServiceUrl() + "/search";
        Map<String, Object> payload = new HashMap<>();
        payload.put("query", query);
        payload.put("top_k", ragProps.getTopK());
        payload.put("min_similarity", ragProps.getMinSimilarity());

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);

        try {
            HttpEntity<Map<String, Object>> entity = new HttpEntity<>(payload, headers);
            String response = restTemplate.exchange(url, HttpMethod.POST, entity, String.class).getBody();
            return objectMapper.readValue(response, new TypeReference<>() {});
        } catch (Exception e) {
            log.warn("RAG 检索失败，使用空知识库: {}", e.getMessage());
            return Collections.emptyList();
        }
    }

    /**
     * 根据户型分析结果生成装修建议（调用 Doubao AI）
     */
    public String generateAdvice(AnalyzeResponse analysis, List<Map<String, Object>> knowledge) {
        String roomJson;
        try {
            roomJson = objectMapper.writeValueAsString(analysis);
        } catch (Exception e) {
            roomJson = analysis.toString();
        }

        StringBuilder knowledgeText = new StringBuilder();
        for (int i = 0; i < knowledge.size(); i++) {
            Map<String, Object> hit = knowledge.get(i);
            String title = String.valueOf(hit.getOrDefault("source_title", "未知来源"));
            String text = String.valueOf(hit.getOrDefault("text", ""));
            knowledgeText.append(String.format("[知识%d] 来源: %s\n%s\n\n", i + 1, title, text));
        }

        String prompt = String.format("""
            你是一位资深的室内装修设计专家。请根据以下户型分析结果和装修知识库，
            为用户提供专业、实用、可操作的装修建议。

            【户型分析结果】
            %s

            【相关装修知识库】
            %s

            请给出针对该户型的：
            1. 整体装修风格建议
            2. 各房间重点注意事项
            3. 水电改造建议
            4. 收纳规划建议
            5. 常见避坑提醒

            请用简洁清晰的语言回答，突出与该户型特点相关的内容。
            """,
            roomJson,
            knowledgeText.toString()
        );

        return callDoubaoText(prompt);
    }

    /**
     * 一站式生成装修建议（检索 + 生成）
     */
    public String generateAdviceForFloorPlan(AnalyzeResponse analysis) {
        List<Map<String, Object>> knowledge = retrieveKnowledge(analysis);
        if (knowledge.isEmpty()) {
            log.warn("知识库为空，跳过 RAG 直接生成通用建议");
        }
        return generateAdvice(analysis, knowledge);
    }

    /**
     * 从户型分析提取检索 query
     */
    private String buildQuery(AnalyzeResponse analysis) {
        StringBuilder q = new StringBuilder();
        q.append("装修建议 ").append(analysis.getTotalArea()).append("平米");

        if (analysis.getRooms() != null) {
            for (AnalyzeResponse.RoomInfo room : analysis.getRooms()) {
                if (room.getName() != null) q.append(" ").append(room.getName());
                if (room.getType() != null) q.append(" ").append(room.getType());
            }
        }

        if (analysis.getPros() != null && !analysis.getPros().isEmpty()) {
            q.append(" ").append(String.join(" ", analysis.getPros()));
        }

        return q.toString();
    }

    private String callDoubaoText(String prompt) {
        Map<String, Object> payload = new HashMap<>();
        payload.put("model", doubaoProps.getModel());
        payload.put("input", List.of(
            Map.of("role", "user", "content", List.of(
                Map.of("type", "input_text", "text", prompt)
            ))
        ));

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.set("Authorization", "Bearer " + doubaoProps.getApiKey());

        HttpEntity<Map<String, Object>> entity = new HttpEntity<>(payload, headers);
        try {
            String body = restTemplate.exchange(
                DOUBAO_BASE_URL + "/responses",
                HttpMethod.POST,
                entity,
                String.class
            ).getBody();

            JsonArray output = JsonParser.parseString(body).getAsJsonObject().getAsJsonArray("output");
            return output.get(0).getAsJsonObject().get("result").getAsString();
        } catch (Exception e) {
            log.error("Doubao AI 调用失败", e);
            return "装修建议生成失败，请稍后重试。";
        }
    }
}
