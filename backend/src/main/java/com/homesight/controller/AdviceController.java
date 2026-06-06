package com.homesight.controller;

import com.homesight.config.AgentProperties;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.RestTemplate;

import java.util.*;

@Slf4j
@RestController
@RequestMapping("/api")
@CrossOrigin(origins = "*")
public class AdviceController {

    private final AgentProperties agentProps;
    private final RestTemplate restTemplate;

    public AdviceController(AgentProperties agentProps) {
        this.agentProps = agentProps;
        this.restTemplate = new RestTemplate();
    }

    @GetMapping("/advice")
    public Map<String, Object> getAdvice(
            @RequestParam String query,
            @RequestParam(required = false) String roomInfo) {
        try {
            Map<String, Object> requestBody = new LinkedHashMap<>();
            requestBody.put("query", query);
            if (roomInfo != null && !roomInfo.isEmpty()) {
                requestBody.put("room_info", roomInfo);
            }

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            HttpEntity<Map<String, Object>> entity = new HttpEntity<>(requestBody, headers);

            String agentUrl = agentProps.getBaseUrl() + "/chat";
            var response = restTemplate.postForObject(agentUrl, entity, LinkedHashMap.class);

            Map<String, Object> result = new LinkedHashMap<>();
            result.put("code", 0);
            result.put("msg", "success");
            result.put("data", response);
            return result;
        } catch (Exception e) {
            log.error("获取装修建议失败", e);
            Map<String, Object> result = new LinkedHashMap<>();
            result.put("code", -1);
            result.put("msg", "AI服务暂时不可用: " + e.getMessage());
            return result;
        }
    }

    @GetMapping("/advice/health")
    public Map<String, Object> agentHealth() {
        try {
            String healthUrl = agentProps.getBaseUrl() + "/health";
            var response = restTemplate.getForObject(healthUrl, LinkedHashMap.class);

            Map<String, Object> result = new LinkedHashMap<>();
            result.put("code", 0);
            result.put("msg", "success");
            result.put("data", response);
            return result;
        } catch (Exception e) {
            Map<String, Object> result = new LinkedHashMap<>();
            result.put("code", -1);
            result.put("msg", "AI服务未启动，请先运行装修知识智能体");
            return result;
        }
    }

    @PostMapping("/advice/ingest")
    public Map<String, Object> ingestVideo(@RequestBody Map<String, String> body) {
        try {
            Map<String, Object> requestBody = new LinkedHashMap<>();
            requestBody.put("url", body.get("url"));
            requestBody.put("chunk_size", 500);

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            HttpEntity<Map<String, Object>> entity = new HttpEntity<>(requestBody, headers);

            String ingestUrl = agentProps.getBaseUrl() + "/ingest";
            var response = restTemplate.postForObject(ingestUrl, entity, LinkedHashMap.class);

            Map<String, Object> result = new LinkedHashMap<>();
            result.put("code", 0);
            result.put("msg", "success");
            result.put("data", response);
            return result;
        } catch (Exception e) {
            log.error("摄入视频失败", e);
            Map<String, Object> result = new LinkedHashMap<>();
            result.put("code", -1);
            result.put("msg", "摄入失败: " + e.getMessage());
            return result;
        }
    }
}
