package com.homesight;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.ComponentScan;

@SpringBootApplication
@ComponentScan(basePackages = "com.homesight")
public class HomeSightApplication {
    public static void main(String[] args) {
        SpringApplication.run(HomeSightApplication.class, args);
    }
}
