package com.datn.repository;

import com.datn.entity.Category;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface CategoryRepository extends JpaRepository<Category, Integer> {

    List<Category> findByParentIsNullAndIsActiveTrue();

    List<Category> findByParent_CategoryIdAndIsActiveTrue(Integer parentId);
}
