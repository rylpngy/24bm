package com.procurement.mall.domain;

import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import javax.imageio.ImageIO;

/** Decode and re-encode raster images; never serve supplier-supplied SVG/HTML or appended payloads. */
public final class MallProductImagePolicy {
  public static final int MAX_BYTES = 5 * 1024 * 1024;
  public record Image(byte[] data, String contentType) {}
  private MallProductImagePolicy() {}

  public static void requireFileName(String name) {
    if (name == null || name.isBlank() || name.length() > 200 || name.chars().anyMatch(Character::isISOControl)
        || name.contains("/") || name.contains("\\") || !name.toLowerCase(java.util.Locale.ROOT).matches(".+\\.(png|jpe?g)")) {
      throw new IllegalArgumentException("商品图片须为 PNG/JPEG，文件名不超过200字且不含路径");
    }
  }

  public static Image validate(byte[] bytes) {
    if (bytes == null || bytes.length == 0 || bytes.length > MAX_BYTES) {
      throw new IllegalArgumentException("商品图片不能为空且不能超过5MB");
    }
    try (var stream = ImageIO.createImageInputStream(new ByteArrayInputStream(bytes))) {
      var readers = ImageIO.getImageReaders(stream);
      if (!readers.hasNext()) throw new IllegalArgumentException("文件不是有效的 PNG/JPEG 图片");
      var reader = readers.next();
      try {
        reader.setInput(stream, true, true);
        String format = reader.getFormatName().toLowerCase(java.util.Locale.ROOT);
        if (!format.equals("png") && !format.equals("jpeg")) throw new IllegalArgumentException("只支持 PNG/JPEG 图片");
        int width = reader.getWidth(0), height = reader.getHeight(0);
        if (width <= 0 || height <= 0 || width > 4096 || height > 4096 || (long) width * height > 16_000_000) {
          throw new IllegalArgumentException("图片尺寸须不超过4096像素及1600万像素");
        }
        BufferedImage image = reader.read(0);
        var output = new ByteArrayOutputStream();
        if (!ImageIO.write(image, format, output) || output.size() > MAX_BYTES) {
          throw new IllegalArgumentException("图片处理后超过5MB，请压缩后上传");
        }
        return new Image(output.toByteArray(), format.equals("png") ? "image/png" : "image/jpeg");
      } finally { reader.dispose(); }
    } catch (java.io.IOException error) {
      throw new IllegalArgumentException("图片无法解码，请重新选择 PNG/JPEG 文件", error);
    }
  }
}
