package com.procurement.sourcing.api;

import com.procurement.common.api.ApiResponse;
import com.procurement.sourcing.application.RfqApplicationService;
import com.procurement.sourcing.application.RfqClarificationApplicationService;
import com.procurement.sourcing.application.RfqResultApplicationService;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/buyer/rfqs")
public class RfqController {
  private final RfqApplicationService rfqApplicationService;
  private final RfqClarificationApplicationService rfqClarificationApplicationService;
  private final RfqResultApplicationService rfqResultApplicationService;

  public RfqController(
      RfqApplicationService rfqApplicationService,
      RfqClarificationApplicationService rfqClarificationApplicationService,
      RfqResultApplicationService rfqResultApplicationService) {
    this.rfqApplicationService = rfqApplicationService;
    this.rfqClarificationApplicationService = rfqClarificationApplicationService;
    this.rfqResultApplicationService = rfqResultApplicationService;
  }

  @GetMapping
  public ApiResponse<List<RfqResponse>> list(
      @RequestParam(required = false) String status,
      @RequestParam(required = false) String keyword) {
    return ApiResponse.ok(rfqApplicationService.listCurrentTenantRfqs(status, keyword));
  }

  @PostMapping
  @ResponseStatus(HttpStatus.CREATED)
  public ApiResponse<RfqResponse> create(@Valid @RequestBody CreateRfqRequest request) {
    return ApiResponse.ok(rfqApplicationService.create(request));
  }

  @PutMapping("/{rfqId}")
  public ApiResponse<RfqResponse> update(
      @PathVariable String rfqId,
      @Valid @RequestBody UpdateRfqRequest request) {
    return ApiResponse.ok(rfqApplicationService.update(rfqId, request));
  }

  // 开标:封存的「报价中」RFQ → 「已开标」(到点开标 / 未到点 force=true 强制),开标后方可评标。
  @PostMapping("/{rfqId}/open")
  public ApiResponse<RfqResponse> open(
      @PathVariable String rfqId,
      @Valid @RequestBody OpenRfqRequest request) {
    return ApiResponse.ok(rfqApplicationService.openBids(rfqId, request.force()));
  }

  // 定标结果公示(采购方):中标人 + 中标通知书 + 本轮报价排名。
  @GetMapping("/{rfqId}/result")
  public ApiResponse<RfqResultResponse> result(@PathVariable String rfqId) {
    return ApiResponse.ok(rfqResultApplicationService.resultForBuyer(rfqId));
  }

  // 终止(采购方):流标(不足法定家数等)/废标(全部不合格、取消),记录理由。
  @PostMapping("/{rfqId}/abort")
  public ApiResponse<RfqResponse> abort(
      @PathVariable String rfqId,
      @Valid @RequestBody AbortRfqRequest request) {
    return ApiResponse.ok(rfqApplicationService.abortRfq(rfqId, request.kind(), request.reason()));
  }

  // 再次报价/BAFO(采购方):已开标 RFQ 发起下一轮报价(重新封存,设新截止)。
  @PostMapping("/{rfqId}/new-round")
  public ApiResponse<RfqResponse> startNewRound(
      @PathVariable String rfqId,
      @Valid @RequestBody NewRoundRequest request) {
    return ApiResponse.ok(
        rfqApplicationService.startNewRound(rfqId, request.deadlineAt(), request.finalRound()));
  }

  // 澄清答疑(采购方):查看该 RFQ 全部澄清。
  @GetMapping("/{rfqId}/clarifications")
  public ApiResponse<List<RfqClarificationResponse>> clarifications(@PathVariable String rfqId) {
    return ApiResponse.ok(rfqClarificationApplicationService.listForBuyer(rfqId));
  }

  // 澄清答疑(采购方):答复,可选广播给全部受邀供应商。
  @PostMapping("/{rfqId}/clarifications/{clarificationId}/answer")
  public ApiResponse<RfqClarificationResponse> answerClarification(
      @PathVariable String rfqId,
      @PathVariable String clarificationId,
      @Valid @RequestBody AnswerClarificationRequest request) {
    return ApiResponse.ok(
        rfqClarificationApplicationService.answer(rfqId, clarificationId, request));
  }

  // 加权评标:按价格/交期权重打分排名,推荐总分最高者(默认价格70/交期30)。
  @GetMapping("/{rfqId}/evaluation")
  public ApiResponse<BidEvaluationResponse> evaluation(
      @PathVariable String rfqId,
      @RequestParam(defaultValue = "70") int priceWeight,
      @RequestParam(defaultValue = "30") int deliveryWeight) {
    return ApiResponse.ok(rfqApplicationService.evaluateRfq(rfqId, priceWeight, deliveryWeight));
  }
}
