package com.procurement;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

// 定时任务:竞价事件流心跳(AuctionStreamBroker)。
@EnableScheduling
@SpringBootApplication
public class ProcurementApplication {

  public static void main(String[] args) {
    SpringApplication.run(ProcurementApplication.class, args);
  }
}
