package com.homesight.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

@Data
@Configuration
@ConfigurationProperties(prefix = "rag")
public class RagProperties {
    private String serviceUrl = "http://localhost:8000";
    private int topK = 5;
    private double minSimilarity = 0.0;
}
