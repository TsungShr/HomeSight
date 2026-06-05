package com.homesight.controller;

import com.homesight.dto.AnalyzeResponse;
import com.homesight.dto.LayoutResponse;
import com.homesight.entity.FloorPlan;
import com.homesight.entity.RoomLayout;
import com.homesight.service.AiService;
import com.homesight.service.LayoutAgentService;
import com.homesight.service.OssService;
import com.homesight.service.RagService;
import com.homesight.repository.FloorPlanRepository;
import com.homesight.repository.RoomLayoutRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.Data;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;
import java.util.*;

@SuppressWarnings("unchecked")
@Slf4j
@RestController
@RequestMapping("/api")
@CrossOrigin(origins = "*")
public class FloorPlanController {

    @Autowired private OssService ossService;
    @Autowired private AiService aiService;
    @Autowired private LayoutAgentService layoutAgentService;
    @Autowired private FloorPlanRepository floorPlanRepo;
    @Autowired private RoomLayoutRepository roomLayoutRepo;
    @Autowired private ObjectMapper objectMapper;

    public static class ApiResult {
        public int code;
        public String msg;
        public Object data;
        public static ApiResult ok(Object data) {
            ApiResult r = new ApiResult(); r.code = 0; r.msg = "success"; r.data = data; return r;
        }
        public static ApiResult fail(String msg) {
            ApiResult r = new ApiResult(); r.code = -1; r.msg = msg; return r;
        }
    }

    @Data
    public static class LayoutRequest {
        public String roomDataJson;
        public String outletLevel;  // 充足/标准/基础
        public String networkLevel; // 全屋WiFi/局部覆盖/基础
        public Boolean hasSmartHome;
    }

    @PostMapping("/upload")
    public ApiResult upload(@RequestBody Map<String, String> body) {
        try {
            String openId = body.get("openId");
            String imageBase64 = body.get("imageBase64");
            String fileName = body.getOrDefault("fileName", "floorplan.jpg");

            byte[] imageBytes = java.util.Base64.getDecoder().decode(imageBase64);
            String imageUrl = ossService.uploadBytes(imageBytes, openId, fileName);

            FloorPlan fp = new FloorPlan();
            fp.setOpenId(openId);
            fp.setFileName(fileName);
            fp.setImageUrl(imageUrl);
            fp.setStatus("draft");
            fp = floorPlanRepo.save(fp);

            Map<String, Object> result = new HashMap<>();
            result.put("floorPlanId", fp.getId());
            result.put("imageUrl", imageUrl);
            return ApiResult.ok(result);
        } catch (Exception e) {
            log.error("上传失败", e);
            return ApiResult.fail("上传失败: " + e.getMessage());
        }
    }

    @PostMapping("/analyze/{floorPlanId}")
    public ApiResult analyze(
            @PathVariable Long floorPlanId,
            @RequestBody Map<String, String> body) {
        try {
            byte[] imageBytes;
            String imageBase64 = body.get("imageBase64");
            String mimeType = "image/jpeg";

            if (imageBase64 != null && !imageBase64.isEmpty()) {
                imageBytes = java.util.Base64.getDecoder().decode(imageBase64);
            } else {
                FloorPlan fp = floorPlanRepo.findById(floorPlanId)
                        .orElseThrow(() -> new RuntimeException("户型不存在"));
                if (fp.getImageUrl() == null) {
                    return ApiResult.fail("缺少图片数据");
                }
                imageBytes = ossService.downloadImage(fp.getImageUrl()).readAllBytes();
            }

            AnalyzeResponse resp = aiService.analyzeFloorplanBase64(imageBytes, mimeType);

            FloorPlan fp = floorPlanRepo.findById(floorPlanId)
                    .orElseThrow(() -> new RuntimeException("户型不存在"));
            fp.setFloorplanData(objectMapper.writeValueAsString(resp.getFloorplanData()));
            fp.setAnalysisResult(objectMapper.writeValueAsString(resp));
            fp.setStatus("analyzed");
            floorPlanRepo.save(fp);

            Map<String, Object> result = objectMapper.convertValue(resp, Map.class);
            result.put("floorPlanId", floorPlanId);
            return ApiResult.ok(result);
        } catch (Exception e) {
            log.error("AI分析失败", e);
            return ApiResult.fail("分析失败: " + e.getMessage());
        }
    }

    @GetMapping("/floorplan/{floorPlanId}")
    public ApiResult getFloorPlan(@PathVariable Long floorPlanId) {
        try {
            FloorPlan fp = floorPlanRepo.findById(floorPlanId)
                    .orElseThrow(() -> new RuntimeException("户型不存在"));
            return ApiResult.ok(fp);
        } catch (Exception e) {
            return ApiResult.fail(e.getMessage());
        }
    }

    @GetMapping("/floorplans")
    public ApiResult listFloorPlans(@RequestParam String openId) {
        try {
            List<FloorPlan> list = floorPlanRepo.findByOpenIdOrderByCreatedAtDesc(openId);
            return ApiResult.ok(list);
        } catch (Exception e) {
            return ApiResult.fail(e.getMessage());
        }
    }

    @PostMapping("/layout/{floorPlanId}")
    public ApiResult generateLayout(
            @PathVariable Long floorPlanId,
            @RequestBody LayoutRequest req) {
        try {
            FloorPlan fp = floorPlanRepo.findById(floorPlanId)
                    .orElseThrow(() -> new RuntimeException("户型不存在"));
            LayoutResponse resp = aiService.generateLayout(
                    req.roomDataJson != null ? req.roomDataJson : fp.getFloorplanData(),
                    req.outletLevel != null ? req.outletLevel : "标准",
                    req.networkLevel != null ? req.networkLevel : "全屋WiFi",
                    req.hasSmartHome != null ? req.hasSmartHome : false
            );
            Map<String, Object> result = objectMapper.convertValue(resp, Map.class);
            result.put("floorPlanId", floorPlanId);
            return ApiResult.ok(result);
        } catch (Exception e) {
            log.error("生成水电布局失败", e);
            return ApiResult.fail("生成失败: " + e.getMessage());
        }
    }

    /**
     * 通过装修知识智能体 + 豆包图生图生成水电布局（文字建议 + 图片）
     *
     * 流程：Agent获取文字建议 → 豆包图生图 → OSS持久化 → 返回
     */
    @PostMapping("/layout-agent/{floorPlanId}")
    public ApiResult generateLayoutWithAgent(
            @PathVariable Long floorPlanId,
            @RequestBody LayoutRequest req) {
        try {
            FloorPlan fp = floorPlanRepo.findById(floorPlanId)
                    .orElseThrow(() -> new RuntimeException("户型不存在"));

            String roomDataJson = req.roomDataJson != null ? req.roomDataJson : fp.getFloorplanData();
            if (roomDataJson == null || roomDataJson.isEmpty()) {
                return ApiResult.fail("缺少户型数据，请先完成户型分析");
            }

            LayoutAgentService.LayoutResult result = layoutAgentService.generateLayoutWithImage(
                    fp.getImageUrl(),
                    roomDataJson,
                    null, // roomInfo
                    req.outletLevel != null ? req.outletLevel : "标准",
                    req.networkLevel != null ? req.networkLevel : "全屋WiFi",
                    req.hasSmartHome != null ? req.hasSmartHome : false
            );

            Map<String, Object> resp = new HashMap<>();
            resp.put("floorPlanId", floorPlanId);
            resp.put("textAdvice", result.textAdvice);
            resp.put("imageUrl", result.imageUrl);
            return ApiResult.ok(resp);
        } catch (Exception e) {
            log.error("Agent生成水电布局失败", e);
            return ApiResult.fail("生成失败: " + e.getMessage());
        }
    }

    @PostMapping("/roomlayout/{floorPlanId}")
    public ApiResult saveRoomLayout(
            @PathVariable Long floorPlanId,
            @RequestBody Map<String, Object> payload) {
        try {
            String roomId = (String) payload.get("roomId");
            RoomLayout rl = roomLayoutRepo.findByFloorPlanIdAndRoomId(floorPlanId, roomId)
                    .orElse(new RoomLayout());
            rl.setFloorPlanId(floorPlanId);
            rl.setRoomId(roomId);
            rl.setFurniture(objectMapper.writeValueAsString(payload.get("furniture")));
            rl.setLayoutData(objectMapper.writeValueAsString(payload.get("layoutData")));
            roomLayoutRepo.save(rl);
            return ApiResult.ok(Map.of("saved", true));
        } catch (Exception e) {
            log.error("保存房间布局失败", e);
            return ApiResult.fail(e.getMessage());
        }
    }

    @GetMapping("/roomlayout/{floorPlanId}")
    public ApiResult getRoomLayout(
            @PathVariable Long floorPlanId,
            @RequestParam(required = false) String roomId) {
        try {
            if (roomId != null) {
                RoomLayout rl = roomLayoutRepo.findByFloorPlanIdAndRoomId(floorPlanId, roomId)
                        .orElse(new RoomLayout());
                return ApiResult.ok(rl);
            } else {
                List<RoomLayout> list = roomLayoutRepo.findByFloorPlanId(floorPlanId);
                return ApiResult.ok(list);
            }
        } catch (Exception e) {
            return ApiResult.fail(e.getMessage());
        }
    }

    @DeleteMapping("/floorplan/{floorPlanId}")
    public ApiResult deleteFloorPlan(@PathVariable Long floorPlanId) {
        try {
            floorPlanRepo.deleteById(floorPlanId);
            return ApiResult.ok(Map.of("deleted", true));
        } catch (Exception e) {
            return ApiResult.fail(e.getMessage());
        }
    }
}
