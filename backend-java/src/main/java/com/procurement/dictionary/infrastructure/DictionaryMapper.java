package com.procurement.dictionary.infrastructure;

import com.procurement.dictionary.domain.DictionaryEntry;
import com.procurement.dictionary.domain.DictionaryTypeSummary;
import java.util.List;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

@Mapper
public interface DictionaryMapper {

  @Select("""
      select type, code, label, sort_order, status
      from dictionaries
      where type = #{type}
        and status = 'active'
      order by sort_order, code
      """)
  List<DictionaryEntry> listActiveByType(@Param("type") String type);

  // ── 平台运营维护(含停用条目) ─────────────────────────────
  @Select("""
      select type,
             count(1) as entry_count,
             count(1) filter (where status = 'active') as active_count
      from dictionaries
      group by type
      order by type
      """)
  List<DictionaryTypeSummary> listTypeSummaries();

  @Select("""
      select type, code, label, sort_order, status
      from dictionaries
      where type = #{type}
      order by sort_order, code
      """)
  List<DictionaryEntry> listAllByType(@Param("type") String type);

  @Select("select type, code, label, sort_order, status from dictionaries where type = #{type} and code = #{code}")
  DictionaryEntry find(@Param("type") String type, @Param("code") String code);

  @Insert("""
      insert into dictionaries (type, code, label, sort_order, status)
      values (#{type}, #{code}, #{label}, #{sortOrder}, #{status})
      """)
  void insert(
      @Param("type") String type,
      @Param("code") String code,
      @Param("label") String label,
      @Param("sortOrder") int sortOrder,
      @Param("status") String status);

  // 主键 type+code 不可改;仅名称/排序/状态可维护(引用安全:停用而非删除)。
  @Update("""
      update dictionaries set label = #{label}, sort_order = #{sortOrder}, status = #{status},
        updated_at = now()
      where type = #{type} and code = #{code}
      """)
  int update(
      @Param("type") String type,
      @Param("code") String code,
      @Param("label") String label,
      @Param("sortOrder") int sortOrder,
      @Param("status") String status);
}
