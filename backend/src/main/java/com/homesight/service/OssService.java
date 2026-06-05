package com.homesight.service;

import com.aliyun.oss.OSS;
import com.aliyun.oss.OSSClientBuilder;
import com.aliyun.oss.common.auth.DefaultCredentialProvider;
import com.aliyun.oss.model.*;
import com.homesight.config.OssProperties;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import java.io.ByteArrayInputStream;
import java.io.InputStream;
import java.util.UUID;

@Slf4j
@Service
public class OssService {

    private final OssProperties props;

    public OssService(OssProperties props) {
        this.props = props;
    }

    private OSS buildClient() {
        return OSSClientBuilder.create()
                .endpoint(props.getEndpoint())
                .credentialsProvider(new DefaultCredentialProvider(
                        props.getAccessKeyId(), props.getAccessKeySecret()))
                .build();
    }

    public String uploadBytes(byte[] data, String openId, String fileName) throws Exception {
        OSS client = buildClient();
        String ext = getExtension(fileName);
        String key = "floorplans/" + openId + "/" + UUID.randomUUID() + "." + ext;

        ObjectMetadata metadata = new ObjectMetadata();
        metadata.setHeader("x-oss-storage-class", StorageClass.Standard.toString());

        PutObjectRequest request = new PutObjectRequest(
                props.getBucketName(), key, new ByteArrayInputStream(data));
        request.setMetadata(metadata);
        client.putObject(request);
        client.shutdown();

        String url = props.getUrlPrefix() + key;
        log.info("上传文件成功: {}", url);
        return url;
    }

    /**
     * 上传 byte[] 到 OSS，使用自定义 key 路径
     */
    public String uploadBytesWithKey(byte[] data, String key, String contentType) throws Exception {
        OSS client = buildClient();

        ObjectMetadata metadata = new ObjectMetadata();
        metadata.setHeader("x-oss-storage-class", StorageClass.Standard.toString());
        if (contentType != null) {
            metadata.setContentType(contentType);
        }

        PutObjectRequest request = new PutObjectRequest(
                props.getBucketName(), key, new ByteArrayInputStream(data));
        request.setMetadata(metadata);
        client.putObject(request);
        client.shutdown();

        String url = props.getUrlPrefix() + key;
        log.info("上传文件成功: {}", url);
        return url;
    }

    public InputStream downloadImage(String url) throws Exception {
        OSS client = buildClient();
        String key = extractKey(url);
        OSSObject obj = client.getObject(props.getBucketName(), key);
        InputStream is = obj.getObjectContent();
        client.shutdown();
        return is;
    }

    private String extractKey(String url) {
        return url.replace(props.getUrlPrefix(), "");
    }

    private String getExtension(String filename) {
        if (filename == null || !filename.contains(".")) return "jpg";
        return filename.substring(filename.lastIndexOf('.') + 1).toLowerCase();
    }
}
