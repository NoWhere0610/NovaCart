package com.datn.controller;

import com.datn.dto.admin.AdminVoucherDto;
import com.datn.service.VoucherService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/admin/vouchers")
@RequiredArgsConstructor
public class AdminVoucherController {

    private final VoucherService voucherService;

    @GetMapping
    @PreAuthorize("@perm.has('VOUCHER_VIEW')")
    public ResponseEntity<List<AdminVoucherDto.Response>> listAll() {
        return ResponseEntity.ok(voucherService.listAll());
    }

    @PostMapping
    @PreAuthorize("@perm.has('VOUCHER_WRITE')")
    public ResponseEntity<AdminVoucherDto.Response> create(@Valid @RequestBody AdminVoucherDto.Request request) {
        return ResponseEntity.ok(voucherService.create(request));
    }

    @PutMapping("/{voucherId}")
    @PreAuthorize("@perm.has('VOUCHER_WRITE')")
    public ResponseEntity<AdminVoucherDto.Response> update(
            @PathVariable Integer voucherId, @Valid @RequestBody AdminVoucherDto.Request request) {
        return ResponseEntity.ok(voucherService.update(voucherId, request));
    }

    @DeleteMapping("/{voucherId}")
    @PreAuthorize("@perm.has('VOUCHER_DELETE')")
    public ResponseEntity<Void> delete(@PathVariable Integer voucherId) {
        voucherService.delete(voucherId);
        return ResponseEntity.noContent().build();
    }
}