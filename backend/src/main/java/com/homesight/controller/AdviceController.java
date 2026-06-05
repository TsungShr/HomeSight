package com.homesight.controller;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.RestTemplate;

import java.util.*;

@RestController
@RequestMapping("/api")
@CrossOrigin(origins = "*")
@Slf4j
public class AdviceController {

    private static final String AGENT_URL = "http://localhost:8081";

    @GetMapping("/advice")
    public Map<String, Object> getAdvice(
            @RequestParam String query,
            @RequestParam(required = false) String roomInfo) {
        try {
            RestTemplate rt = new RestTemplate();
            Map<String, Object> requestBody = new HashMap<>();
            requestBody.put("query", query);
            if (roomInfo != null && !roomInfo.isEmpty()) {
                requestBody.put("roomInfo", roomInfo);
            }

            String url = AGENT_URL + "/chat";
            org.springframework.http.HttpEntity<Map<String, Object>> entity =
                    new org.springframework.http.HttpEntity<>(requestBody);

            var response = rt.postForObject(url, entity, LinkedHashMap.class);

            Map<String, Object> result = new HashMap<>();
            result.put("code", 0);
            result.put("msg", "success");
            result.put("data", response);
            return result;
        } catch (Exception e) {
            log.error("获取装修建议失败", e);
            Map<String, Object> result = new HashMap<>();
            result.put("code", -1);
            result.put("msg", "AI服务暂时不可用: " + e.getMessage());
            return result;
        }
    }

    @GetMapping("/advice/health")
    public Map<String, Object> agentHealth() {
        try {
            RestTemplate rt = new RestTemplate();
            var response = rt.getForObject(AGENT_URL + "/health", LinkedHashMap.class);

            Map<String, Object> result = new HashMap<>();
            result.put("code", 0);
            result.put("msg", "success");
            result.put("data", response);
            return result;
        } catch (Exception e) {
            Map<String, Object> result = new HashMap<>();
            result.put("code", -1);
            result.put("msg", "AI服务未启动，请先运行装修知识智能体");
            return result;
        }
    }

    @PostMapping("/advice/ingest")
    public Map<String, Object> ingestVideo(@RequestBody Map<String, String> body) {
        try {
            RestTemplate rt = new RestTemplate();
            Map<String, Object> requestBody = new HashMap<>();
            requestBody.put("bilibili_url", body.get("bilibili_url"));
            requestBody.put("chunk_size", 500);

            org.springframework.http.HttpEntity<Map<String, Object>> entity =
                    new org.springframework.http.HttpEntity<>(requestBody);

            var response = rt.postForObject(AGENT_URL + "/ingest", entity, LinkedHashMap.class);

            Map<String, Object> result = new HashMap<>();
            result.put("code", 0);
            result.put("msg", "success");
            result.put("data", response);
            return result;
        } catch (Exception e) {
            log.error("摄入视频失败", e);
            Map<String, Object> result = new HashMap<>();
            result.put("code", -1);
            result.put("msg", "摄入失败: " + e.getMessage());
            return result;
        }
    }
}
