package com.homesight.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;
import lombok.Data;

@Data
@Configuration
@ConfigurationProperties(prefix = "doubao")
public class DoubaoProperties {
    private String apiKey;
    private String model;
}
