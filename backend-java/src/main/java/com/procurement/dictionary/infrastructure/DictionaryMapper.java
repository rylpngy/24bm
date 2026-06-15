package com.procurement.dictionary.infrastructure;

import com.procurement.dictionary.domain.DictionaryEntry;
import java.util.List;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Result;
import org.apache.ibatis.annotations.Results;
import org.apache.ibatis.annotations.Select;

@Mapper
public interface DictionaryMapper {

  @Select("""
      select type, code, label, sort_order
      from dictionaries
      where type = #{type}
        and status = 'active'
      order by sort_order, code
      """)
  @Results(id = "dictionaryEntryResults", value = {
      @Result(column = "sort_order", property = "sortOrder")
  })
  List<DictionaryEntry> listActiveByType(@Param("type") String type);
}
