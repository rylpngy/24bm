package com.procurement.mall.api;

public record MallProductMediaResponse(String id, String fileName, String contentType,
    long contentSize, int sortOrder, boolean main, String contentUrl) {}
