package com.datn.controller;

import com.datn.dto.statistics.StatisticsDto;
import com.datn.service.AdminStatisticsService;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;

@RestController
@RequestMapping("/api/admin/statistics")
@RequiredArgsConstructor
public class AdminStatisticsController {

    private final AdminStatisticsService statisticsService;

    @GetMapping
    public ResponseEntity<StatisticsDto.StatisticsResponse> getStatistics(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(defaultValue = "5") int topProductLimit) {
        LocalDate effectiveTo = to != null ? to : LocalDate.now();
        // Mặc định: 30 ngày gần nhất nếu không truyền from
        LocalDate effectiveFrom = from != null ? from : effectiveTo.minusDays(29);
        return ResponseEntity.ok(statisticsService.getStatistics(effectiveFrom, effectiveTo, topProductLimit));
    }
}