package com.homesight.controller;

import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import com.homesight.config.WechatProperties;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.RestTemplate;

import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/api")
@CrossOrigin(origins = "*")
public class UserController {

    private final WechatProperties wechatProps;
    private final RestTemplate restTemplate;

    public UserController(WechatProperties wechatProps) {
        this.wechatProps = wechatProps;
        this.restTemplate = new RestTemplate();
    }

    @GetMapping("/user/openid")
    public Object getOpenId(@RequestParam String code) {
        if (wechatProps.getAppId() == null || wechatProps.getAppId().startsWith("YOUR_")) {
            return Map.of("code", -1, "msg", "微信配置未填写（请在 application.yml 中设置 wechat.app-id 和 wechat.app-secret）");
        }
        try {
            String url = "https://api.weixin.qq.com/sns/jscode2session"
                    + "?appid=" + wechatProps.getAppId()
                    + "&secret=" + wechatProps.getAppSecret()
                    + "&js_code=" + code
                    + "&grant_type=authorization_code";

            HttpHeaders headers = new HttpHeaders();
            headers.set(HttpHeaders.ACCEPT, MediaType.APPLICATION_JSON_VALUE);
            HttpEntity<Void> entity = new HttpEntity<>(headers);

            ResponseEntity<String> resp = restTemplate.exchange(
                    url, HttpMethod.GET, entity, String.class);

            JsonObject json = JsonParser.parseString(resp.getBody()).getAsJsonObject();
            int errcode = json.has("errcode") ? json.get("errcode").getAsInt() : 0;

            if (errcode != 0 || !json.has("openid")) {
                String errmsg = json.has("errmsg") ? json.get("errmsg").getAsString() : "未知错误";
                return Map.of("code", -1, "msg", "获取openId失败: " + errmsg);
            }

            return Map.of("code", 0, "msg", "success", "data",
                    Map.of("openId", json.get("openid").getAsString()));
        } catch (Exception e) {
            log.error("获取openId失败", e);
            return Map.of("code", -1, "msg", "获取openId失败: " + e.getMessage());
        }
    }
}
