package com.procurement;

import static org.assertj.core.api.Assertions.*;

import com.procurement.mall.domain.MallProductImagePolicy;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import javax.imageio.ImageIO;
import org.junit.jupiter.api.Test;

class MallProductImagePolicyTests {
  static byte[] png(int width, int height) throws Exception {
    var output = new ByteArrayOutputStream();
    ImageIO.write(new BufferedImage(width, height, BufferedImage.TYPE_INT_RGB), "png", output);
    return output.toByteArray();
  }

  @Test void acceptsRealRasterAndStripsAppendedPayload() throws Exception {
    byte[] png = png(2, 2);
    var mixed = new ByteArrayOutputStream(); mixed.write(png); mixed.write("<script>evil()</script>".getBytes(java.nio.charset.StandardCharsets.UTF_8));
    var image = MallProductImagePolicy.validate(mixed.toByteArray());
    assertThat(image.contentType()).isEqualTo("image/png");
    assertThat(image.data()).isEqualTo(png);
  }

  @Test void rejectsFakeImagesSvgOversizeAndExcessiveDimensions() throws Exception {
    assertThatThrownBy(() -> MallProductImagePolicy.validate("<svg/>".getBytes())).isInstanceOf(IllegalArgumentException.class);
    assertThatThrownBy(() -> MallProductImagePolicy.validate(new byte[MallProductImagePolicy.MAX_BYTES + 1])).hasMessageContaining("5MB");
    assertThatThrownBy(() -> MallProductImagePolicy.validate(png(4097, 1))).hasMessageContaining("尺寸");
    assertThatThrownBy(() -> MallProductImagePolicy.requireFileName("../private.png")).isInstanceOf(IllegalArgumentException.class);
    assertThatThrownBy(() -> MallProductImagePolicy.requireFileName("script.svg")).isInstanceOf(IllegalArgumentException.class);
  }
}
